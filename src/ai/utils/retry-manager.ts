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
  maxRetries: 100, // Very high number for "never fail" behavior
  initialDelay: 1000, // 1 second
  maxDelay: 300000, // 5 minutes max delay
  backoffMultiplier: 2,
  retryableErrors: [
    '429', 'quota', 'resource has been exhausted', 'rate limit',
    'timeout', 'network', 'connection', 'server error', '500', '502', '503', '504',
    'temporarily unavailable', 'overloaded', 'busy'
  ],
  circuitBreakerThreshold: 10, // After 10 consecutive failures, wait longer
  circuitBreakerTimeout: 60000 // 1 minute circuit breaker timeout
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
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let attempt = 1;

    while (attempt <= this.config.maxRetries) {
      try {
        // Check circuit breaker
        if (this.isCircuitBreakerOpen()) {
          const remainingTime = this.config.circuitBreakerTimeout - (Date.now() - this.lastFailureTime);
          console.warn(`[${operationName}] Circuit breaker open. Waiting ${Math.ceil(remainingTime / 1000)}s before retry...`);
          await this.delay(remainingTime);
          continue;
        }

        console.log(`[${operationName}] Attempt ${attempt}/${this.config.maxRetries}`);

        const result = await operation();

        // Success! Reset failure counters
        this.consecutiveFailures = 0;
        this.circuitBreakerOpen = false;

        console.log(`[${operationName}] Success on attempt ${attempt}`);
        return result;

      } catch (error) {
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();

        console.error(`[${operationName}] Attempt ${attempt} failed:`, error);

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.error(`[${operationName}] Non-retryable error encountered. Failing immediately.`);
          throw error;
        }

        // Check if we should open circuit breaker
        if (this.shouldOpenCircuitBreaker() && !this.circuitBreakerOpen) {
          this.circuitBreakerOpen = true;
          console.warn(`[${operationName}] Circuit breaker opened after ${this.consecutiveFailures} consecutive failures`);
        }

        // If this is the last attempt, throw the error
        if (attempt >= this.config.maxRetries) {
          console.error(`[${operationName}] All ${this.config.maxRetries} attempts exhausted. Final error:`, error);
          throw new Error(`[${operationName}] Operation failed after ${this.config.maxRetries} attempts. Last error: ${error.message}`);
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        console.log(`[${operationName}] Retrying in ${Math.ceil(delay / 1000)}s... (Attempt ${attempt + 1}/${this.config.maxRetries})`);
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
  maxRetries: 200, // Even higher for transcription
  initialDelay: 3000, // Start with 3 seconds for large files
  maxDelay: 900000, // 15 minutes max delay for very large files
});

export const callScoringRetryManager = new RetryManager({
  ...DEFAULT_RETRY_CONFIG,
  maxRetries: 150, // High but slightly less than transcription
  initialDelay: 2000, // Start with 2 seconds for large files
  maxDelay: 900000, // 15 minutes max delay for very large files
});