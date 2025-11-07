import type { Json } from '@/types/common';

/**
 * Cost monitoring utilities for AI-TeleSuite
 * Tracks usage patterns and provides cost insights
 */

interface UsageMetrics {
  timestamp: number;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  duration: number;
  cached: boolean;
  estimatedCost: number;
}

class CostMonitor {
  private metrics: UsageMetrics[] = [];
  private readonly MAX_METRICS = 10000; // Keep last 10k operations

  logUsage(metrics: Omit<UsageMetrics, 'timestamp'>): void {
    this.metrics.push({
      ...metrics,
      timestamp: Date.now()
    });

    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  getDailyUsage(): Record<string, number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const todayMetrics = this.metrics.filter(m => m.timestamp >= todayStart);
    
    return todayMetrics.reduce((acc, metric) => {
      acc[metric.operation] = (acc[metric.operation] || 0) + metric.estimatedCost;
      return acc;
    }, {} as Record<string, number>);
  }

  getCacheHitRate(): number {
    if (this.metrics.length === 0) return 0;
    
    const cached = this.metrics.filter(m => m.cached).length;
    return (cached / this.metrics.length) * 100;
  }

  getTopCostDrivers(limit: number = 5): Array<{operation: string, cost: number, count: number}> {
    const summary = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = { cost: 0, count: 0 };
      }
      acc[metric.operation].cost += metric.estimatedCost;
      acc[metric.operation].count += 1;
      return acc;
    }, {} as Record<string, {cost: number, count: number}>);

    return Object.entries(summary)
      .map(([operation, data]) => ({ operation, ...data }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const cacheHitRate = this.getCacheHitRate();
    const topDrivers = this.getTopCostDrivers(3);

    if (cacheHitRate < 30) {
      suggestions.push('🎯 Low cache hit rate detected. Consider increasing cache TTL or implementing more aggressive caching.');
    }

    if (topDrivers.length > 0 && topDrivers[0].cost > 100) {
      suggestions.push(`💰 "${topDrivers[0].operation}" is your highest cost driver. Consider optimizing this operation first.`);
    }

    const highFrequencyOps = topDrivers.filter(op => op.count > 100);
    if (highFrequencyOps.length > 0) {
      suggestions.push(`🔄 High-frequency operations detected: ${highFrequencyOps.map(op => op.operation).join(', ')}. Consider batching or rate limiting.`);
    }

    return suggestions;
  }

  exportMetrics(): string {
    return JSON.stringify({
      summary: {
        totalOperations: this.metrics.length,
        dailyUsage: this.getDailyUsage(),
        cacheHitRate: this.getCacheHitRate(),
        topCostDrivers: this.getTopCostDrivers(),
        suggestions: this.getOptimizationSuggestions()
      },
      metrics: this.metrics.slice(-100) // Last 100 operations
    }, null, 2);
  }
}

export const costMonitor = new CostMonitor();

/**
 * Wrapper function to track AI operation costs
 */
export async function withCostTracking<T>(
  operation: string,
  model: string,
  fn: () => Promise<T>,
  inputData?: Json
): Promise<T> {
  const startTime = Date.now();
  const cached = false;
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    // Estimate tokens (rough approximation)
    const inputSize = inputData ? JSON.stringify(inputData).length : 1000;
    const outputSize = JSON.stringify(result).length;
    
    costMonitor.logUsage({
      operation,
      model,
      inputTokens: Math.ceil(inputSize / 4),
      outputTokens: Math.ceil(outputSize / 4),
      duration,
      cached,
      estimatedCost: estimateCostFromTokens(Math.ceil(inputSize / 4), Math.ceil(outputSize / 4), model)
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    costMonitor.logUsage({
      operation,
      model,
      inputTokens: 0,
      outputTokens: 0,
      duration,
      cached: false,
      estimatedCost: 0
    });
    
    throw error;
  }
}

function estimateCostFromTokens(inputTokens: number, outputTokens: number, model: string): number {
  // Rough cost estimates (in relative units)
  const costs = {
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    'gemini-1.5-pro': { input: 3.5, output: 10.5 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3 }
  };

  const modelCosts = costs[model as keyof typeof costs] || costs['gemini-1.5-flash'];
  
  return (inputTokens * modelCosts.input + outputTokens * modelCosts.output) / 1000000;
}
