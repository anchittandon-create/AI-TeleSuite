/**
 * AI Response Caching System
 * Reduces API costs by caching identical requests for 24 hours
 */

import crypto from 'crypto';
import type { Json } from '@/types/common';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

class AICache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory bloat

  private normalizeInput(input: Json): string {
    if (typeof input !== 'object' || input === null) {
      return JSON.stringify(input);
    }

    const sortedKeys = Array.isArray(input)
      ? undefined
      : Object.keys(input as Record<string, Json>).sort();
    return JSON.stringify(input, sortedKeys);
  }

  private generateKey(input: Json): string {
    const serialized = this.normalizeInput(input);
    return crypto.createHash('md5').update(serialized).digest('hex');
  }

  private cleanup(): void {
    const now = Date.now();
    let deleted = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        deleted++;
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      
      entries.forEach(([key]) => this.cache.delete(key));
    }
  }

  get<T>(input: Json): T | null {
    this.cleanup();
    const key = this.generateKey(input);
    const entry = this.cache.get(key);
    
    if (entry && entry.expiresAt > Date.now()) {
      console.log('🎯 AI Cache HIT - Saving API costs');
      return entry.data as T;
    }
    
    return null;
  }

  set<T>(input: Json, data: T, ttl: number = this.DEFAULT_TTL): void {
    const key = this.generateKey(input);
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
    
    console.log('💾 AI Cache SET - Response cached for future use');
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    const now = Date.now();
    const activeEntries = Array.from(this.cache.values())
      .filter(entry => entry.expiresAt > now).length;
    
    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries: this.cache.size - activeEntries,
    };
  }
}

export const aiCache = new AICache();

/**
 * Wrapper function to add caching to any AI operation
 */
export async function withAICache<T>(
  input: Json,
  operation: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = aiCache.get<T>(input);
  if (cached) {
    return cached;
  }

  // Execute operation and cache result
  const result = await operation();
  aiCache.set(input, result, ttl);
  
  return result;
}
