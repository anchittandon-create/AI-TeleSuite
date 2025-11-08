/**
 * Simple in-memory rate limiter for hobby projects
 * Resets on server restart - good enough for low-cost hobby use
 * For production, use Redis or database-backed rate limiting
 */

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string;
}

class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  check(config: RateLimiterConfig): { allowed: boolean; remaining: number; resetAt: Date } {
    const { maxRequests, windowMs, identifier } = config;
    const now = Date.now();
    
    // Get or create timestamp array for this identifier
    let stamps = this.timestamps.get(identifier) || [];
    
    // Remove expired timestamps
    stamps = stamps.filter(ts => now - ts < windowMs);
    
    // Update the map
    this.timestamps.set(identifier, stamps);
    
    const remaining = Math.max(0, maxRequests - stamps.length);
    const resetAt = stamps.length > 0 
      ? new Date(stamps[0] + windowMs)
      : new Date(now + windowMs);
    
    if (stamps.length >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }
    
    // Add current timestamp
    stamps.push(now);
    this.timestamps.set(identifier, stamps);
    
    return { 
      allowed: true, 
      remaining: remaining - 1,
      resetAt
    };
  }

  /**
   * Get current stats without incrementing counter
   */
  getStats(identifier: string, windowMs: number): { count: number; remaining: number } {
    const now = Date.now();
    const stamps = (this.timestamps.get(identifier) || [])
      .filter(ts => now - ts < windowMs);
    
    return {
      count: stamps.length,
      remaining: Math.max(0, stamps.length),
    };
  }

  /**
   * Clear all rate limit data (useful for testing)
   */
  reset(identifier?: string): void {
    if (identifier) {
      this.timestamps.delete(identifier);
    } else {
      this.timestamps.clear();
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Pre-configured limiters for common use cases
export const RATE_LIMITS = {
  // Very expensive operations (audio transcription, call scoring)
  EXPENSIVE: {
    maxRequests: parseInt(process.env.MAX_EXPENSIVE_CALLS_PER_HOUR || '5'),
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Moderate cost operations (AI text generation, data analysis)
  MODERATE: {
    maxRequests: parseInt(process.env.MAX_MODERATE_CALLS_PER_HOUR || '20'),
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Light operations (simple queries, lookups)
  LIGHT: {
    maxRequests: parseInt(process.env.MAX_LIGHT_CALLS_PER_HOUR || '100'),
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const;
