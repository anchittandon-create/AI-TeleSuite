/**
 * Robust retry utility for AI operations that must never fail
 * Implements exponential backoff, circuit breaker, and comprehensive error handling
 */

export interface RetryConfig {
  maxRetries: number; // Set to a very high number for "never fail" behavior
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  circuitBreakerThreshold: number; // Number of consecutive failures before circuit breaker
  circuitBreakerTimeout: number; // How long to wait when circuit breaker is open
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5, // Reduced from 100 for faster failures
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds max delay (reduced from 5 minutes)
  backoffMultiplier: 2,
  retryableErrors: [
    '429', 'quota', 'resource has been exhausted', 'rate limit',
    'timeout', 'network', 'connection', 'server error', '500', '502', '503', '504',
    'temporarily unavailable', 'overloaded', 'busy'
  ],
  circuitBreakerThreshold: 3, // Reduced from 10 for faster circuit breaking
  circuitBreakerTimeout: 30000 // 30 seconds (reduced from 1 minute)
};

export class RetryManager {
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private circuitBreakerOpen = false;

  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  private isRetryableError(error: any): boolean {
    if (!error) return false;

    const errorMessage = (error.message || error.toString() || '').toLowerCase();
    const errorCode = error.code || error.status || '';

    return this.config.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError.toLowerCase()) ||
      errorCode.toString().includes(retryableError)
    );
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, this.config.maxDelay);
  }

  private shouldOpenCircuitBreaker(): boolean {
    return this.consecutiveFailures >= this.config.circuitBreakerThreshold;
  }

  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpen) return false;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    if (timeSinceLastFailure >= this.config.circuitBreakerTimeout) {
      // Circuit breaker timeout expired, close it
      this.circuitBreakerOpen = false;
      this.consecutiveFailures = 0;
      return false;
    }

    return true;
  }

  async execute<T>(
    operation: (attempt: number) => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let attempt = 1;

    while (attempt <= this.config.maxRetries) {
      try {
        // Check circuit breaker
        if (this.isCircuitBreakerOpen()) {
          const remainingTime = this.config.circuitBreakerTimeout - (Date.now() - this.lastFailureTime);
          console.log(`[${operationName}] Circuit breaker is open. Waiting for ${Math.round(remainingTime / 1000)}s...`);
          await this.delay(remainingTime);
          console.log(`[${operationName}] Circuit breaker wait finished. Retrying.`);
          continue;
        }

        const result = await operation(attempt);

        // Success! Reset failure counters
        console.log(`[${operationName}] Operation successful on attempt ${attempt}.`);
        this.consecutiveFailures = 0;
        this.circuitBreakerOpen = false;

        return result;

      } catch (error) {
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[${operationName}] Attempt ${attempt} failed. Error: ${errorMsg}`);

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.error(`[${operationName}] Non-retryable error encountered. Aborting.`, error);
          throw error;
        }

        // Check if we should open circuit breaker
        if (this.shouldOpenCircuitBreaker() && !this.circuitBreakerOpen) {
          console.error(`[${operationName}] Circuit breaker threshold (${this.config.circuitBreakerThreshold}) reached. Opening circuit for ${this.config.circuitBreakerTimeout / 1000}s.`);
          this.circuitBreakerOpen = true;
        }

        // If this is the last attempt, throw the error
        if (attempt >= this.config.maxRetries) {
          console.error(`[${operationName}] Operation failed after ${this.config.maxRetries} attempts. Last error: ${errorMsg}`);
          throw new Error(`[${operationName}] Operation failed after ${this.config.maxRetries} attempts. Last error: ${errorMsg}`);
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        console.log(`[${operationName}] Waiting for ${delay.toFixed(2)}ms before next attempt (${attempt + 1}/${this.config.maxRetries}).`);
        await this.delay(delay);

        attempt++;
      }
    }

    // This should never be reached, but just in case
    throw new Error(`[${operationName}] Unexpected error: retry loop exited without success or failure`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Reset the retry manager state (useful for testing or manual intervention)
  reset(): void {
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.circuitBreakerOpen = false;
  }

  // Get current status
  getStatus() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      timeSinceLastFailure: Date.now() - this.lastFailureTime
    };
  }
}

// Create singleton instances for different operations
export const transcriptionRetryManager = new RetryManager({
  ...DEFAULT_RETRY_CONFIG,
  maxRetries: 5, // Reduced from 200 for cost savings
  initialDelay: 2000, // Start with 2 seconds for large files
  maxDelay: 60000, // 1 minute max delay (reduced from 15 minutes)
});

export const callScoringRetryManager = new RetryManager({
  ...DEFAULT_RETRY_CONFIG,
  maxRetries: 5, // Reduced from 150 for cost savings
  initialDelay: 2000, // Start with 2 seconds for large files
  maxDelay: 60000, // 1 minute max delay (reduced from 15 minutes)
});