/**
 * AI Request Rate Limiter and Batcher
 * Prevents excessive API calls and optimizes request patterns
 */

interface QueuedRequest {
  id: string;
  operation: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  priority: number;
  timestamp: number;
}

class AIRequestManager {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly MAX_CONCURRENT = 3; // Limit concurrent requests
  private readonly MIN_DELAY = 1000; // 1 second between requests
  private readonly BATCH_SIZE = 5; // Process in batches
  private activeRequests = 0;
  private lastRequestTime = 0;

  async enqueue<T>(
    operation: () => Promise<T>, 
    priority: number = 1
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: Math.random().toString(36).substring(7),
        operation,
        resolve: value => resolve(value as T),
        reject: error => reject(error),
        priority,
        timestamp: Date.now(),
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.activeRequests >= this.MAX_CONCURRENT) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      const batch = this.queue.splice(0, Math.min(this.BATCH_SIZE, this.queue.length));
      
      for (const request of batch) {
        this.executeRequest(request);
      }
    }

    this.processing = false;
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    this.activeRequests++;

    try {
      // Rate limiting - ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_DELAY) {
        await new Promise(resolve => 
          setTimeout(resolve, this.MIN_DELAY - timeSinceLastRequest)
        );
      }

      this.lastRequestTime = Date.now();
      
      console.log(`🚀 Executing AI request ${request.id} (Queue: ${this.queue.length}, Active: ${this.activeRequests})`);
      
      const result = await request.operation();
      request.resolve(result);
    } catch (error) {
      console.error(`❌ AI request ${request.id} failed:`, error);
      request.reject(error);
    } finally {
      this.activeRequests--;
      
      // Continue processing if there are more requests
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      averageWaitTime: this.queue.length > 0 
        ? (Date.now() - this.queue[0].timestamp) / 1000 
        : 0,
    };
  }

  clear(): void {
    // Reject all pending requests
    this.queue.forEach(request => 
      request.reject(new Error('Request queue cleared'))
    );
    this.queue = [];
  }
}

export const aiRequestManager = new AIRequestManager();

/**
 * Wrapper to automatically queue AI requests with rate limiting
 */
export async function queueAIRequest<T>(
  operation: () => Promise<T>,
  priority: number = 1
): Promise<T> {
  return aiRequestManager.enqueue(operation, priority);
}
