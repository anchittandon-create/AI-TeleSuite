/**
 * Enhanced Feature Logger for AI-TeleSuite
 * Provides comprehensive logging for all features with performance tracking,
 * error monitoring, and usage analytics.
 */

export interface FeatureUsageMetrics {
  featureName: string;
  moduleType: 'api' | 'component' | 'page' | 'hook';
  action: 'view' | 'interaction' | 'api_call' | 'error' | 'success' | 'navigation';
  details?: Record<string, unknown>;
  performance?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {
    userAgent?: string;
    timestamp: string;
    sessionId: string;
    userId?: string;
  };
}

export interface FeatureHealthCheck {
  featureName: string;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  lastChecked: string;
  responseTime?: number;
  errorCount: number;
  successCount: number;
  details?: Record<string, unknown>;
}

export class FeatureLogger {
  private static instance: FeatureLogger;
  private sessionId: string;
  private metrics: FeatureUsageMetrics[] = [];
  private healthChecks: Map<string, FeatureHealthCheck> = new Map();
  private maxMetricsToStore = 100;

  constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getInstance(): FeatureLogger {
    if (!FeatureLogger.instance) {
      FeatureLogger.instance = new FeatureLogger();
    }
    return FeatureLogger.instance;
  }

  /**
   * Log feature usage with comprehensive tracking
   */
  logFeatureUsage(params: {
    featureName: string;
    moduleType: FeatureUsageMetrics['moduleType'];
    action: FeatureUsageMetrics['action'];
    details?: Record<string, any>;
    error?: Error;
    performanceMarks?: { start: number; end: number };
  }): void {
    const { featureName, moduleType, action, details, error, performanceMarks } = params;

    const metric: FeatureUsageMetrics = {
      featureName,
      moduleType,
      action,
      details: this.sanitizeDetails(details),
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      },
    };

    // Add performance data if provided
    if (performanceMarks) {
      metric.performance = {
        startTime: performanceMarks.start,
        endTime: performanceMarks.end,
        duration: performanceMarks.end - performanceMarks.start,
      };
    }

    // Add error data if provided
    if (error) {
      const errorCode = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : undefined;
      metric.error = {
        message: error.message,
        stack: error.stack,
        code: errorCode,
      };
    }

    this.addMetric(metric);
    this.updateHealthCheck(featureName, action === 'error' ? 'error' : 'healthy', metric.performance?.duration);
    
    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(metric);
    }
  }

  /**
   * Log page navigation
   */
  logPageNavigation(fromPath: string, toPath: string, loadTime?: number): void {
    this.logFeatureUsage({
      featureName: `navigation_${toPath.replace(/\//g, '_')}`,
      moduleType: 'page',
      action: 'navigation',
      details: { fromPath, toPath },
      performanceMarks: loadTime ? { start: Date.now() - loadTime, end: Date.now() } : undefined,
    });
  }

  /**
   * Log API calls with timing
   */
  logApiCall(endpoint: string, method: string, status: number, responseTime: number, error?: Error): void {
    this.logFeatureUsage({
      featureName: `api_${endpoint.replace(/\//g, '_')}`,
      moduleType: 'api',
      action: status >= 200 && status < 300 ? 'success' : 'error',
      details: { endpoint, method, status },
      error,
      performanceMarks: { start: Date.now() - responseTime, end: Date.now() },
    });
  }

  /**
   * Log component interactions
   */
  logComponentInteraction(componentName: string, interactionType: string, details?: Record<string, any>): void {
    this.logFeatureUsage({
      featureName: componentName,
      moduleType: 'component',
      action: 'interaction',
      details: { interactionType, ...details },
    });
  }

  /**
   * Get feature usage statistics
   */
  getFeatureStats(featureName?: string): {
    totalUsage: number;
    errorRate: number;
    averageResponseTime: number;
    lastUsed: string | null;
    topActions: Array<{ action: string; count: number }>;
  } {
    const relevantMetrics = featureName 
      ? this.metrics.filter(m => m.featureName === featureName)
      : this.metrics;

    const totalUsage = relevantMetrics.length;
    const errors = relevantMetrics.filter(m => m.action === 'error');
    const errorRate = totalUsage > 0 ? (errors.length / totalUsage) * 100 : 0;
    
    const responseTimes = relevantMetrics
      .filter(m => m.performance?.duration)
      .map(m => m.performance!.duration);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const lastUsed = relevantMetrics.length > 0 
      ? relevantMetrics[0].metadata?.timestamp || null 
      : null;

    // Count actions
    const actionCounts = new Map<string, number>();
    relevantMetrics.forEach(m => {
      actionCounts.set(m.action, (actionCounts.get(m.action) || 0) + 1);
    });
    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    return { totalUsage, errorRate, averageResponseTime, lastUsed, topActions };
  }

  /**
   * Get all health checks
   */
  getAllHealthChecks(): FeatureHealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): FeatureUsageMetrics[] {
    return [...this.metrics];
  }

    /**
   * Get current metrics
   */
  getMetrics(): Record<string, any> {
    return { ...this.metrics };
  }

  /**
   * Clear old metrics (older than 7 days)
   */
  clearOldMetrics(): void {
    this.metrics = [];
    this.healthChecks.clear();
  }

  private addMetric(metric: FeatureUsageMetrics): void {
    this.metrics.unshift(metric);
    if (this.metrics.length > this.maxMetricsToStore) {
      this.metrics = this.metrics.slice(0, this.maxMetricsToStore);
    }
  }

  private updateHealthCheck(featureName: string, status: FeatureHealthCheck['status'], responseTime?: number): void {
    const existing = this.healthChecks.get(featureName);
    const healthCheck: FeatureHealthCheck = {
      featureName,
      status,
      lastChecked: new Date().toISOString(),
      responseTime,
      errorCount: existing?.errorCount || 0,
      successCount: existing?.successCount || 0,
    };

    if (status === 'error') {
      healthCheck.errorCount++;
    } else if (status === 'healthy') {
      healthCheck.successCount++;
    }

    this.healthChecks.set(featureName, healthCheck);
  }

  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return undefined;
    
    // Remove sensitive data and large payloads
    const sanitized = { ...details };
    
    // Remove API keys, passwords, tokens
    const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'credential'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    // Truncate large strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
        sanitized[key] = sanitized[key].substring(0, 500) + '... [TRUNCATED]';
      }
    });

    return sanitized;
  }

  private logToConsole(metric: FeatureUsageMetrics): void {
    const emoji = this.getActionEmoji(metric.action);
    const color = this.getActionColor(metric.action);
    
    console.group(
      `%c${emoji} ${metric.featureName} [${metric.moduleType}]`,
      `color: ${color}; font-weight: bold;`
    );
    console.log('Action:', metric.action);
    console.log('Timestamp:', metric.metadata?.timestamp);
    if (metric.performance) {
      console.log('Duration:', `${metric.performance.duration}ms`);
    }
    if (metric.details) {
      console.log('Details:', metric.details);
    }
    if (metric.error) {
      console.error('Error:', metric.error);
    }
    console.groupEnd();
  }

  private getActionEmoji(action: FeatureUsageMetrics['action']): string {
    const emojiMap = {
      view: '👁️',
      interaction: '🖱️',
      api_call: '🌐',
      error: '❌',
      success: '✅',
      navigation: '🧭',
    };
    return emojiMap[action] || '📝';
  }

  private getActionColor(action: FeatureUsageMetrics['action']): string {
    const colorMap = {
      view: '#2563eb',
      interaction: '#7c3aed',
      api_call: '#0891b2',
      error: '#dc2626',
      success: '#16a34a',
      navigation: '#ea580c',
    };
    return colorMap[action] || '#6b7280';
  }
}

// Export singleton instance
export const featureLogger = FeatureLogger.getInstance();

// React hook for easy usage
export function useFeatureLogger() {
  const logFeature = (params: Parameters<typeof featureLogger.logFeatureUsage>[0]) => {
    featureLogger.logFeatureUsage(params);
  };

  const logNavigation = (fromPath: string, toPath: string, loadTime?: number) => {
    featureLogger.logPageNavigation(fromPath, toPath, loadTime);
  };

  const logApi = (endpoint: string, method: string, status: number, responseTime: number, error?: Error) => {
    featureLogger.logApiCall(endpoint, method, status, responseTime, error);
  };

  const logComponent = (componentName: string, interactionType: string, details?: Record<string, any>) => {
    featureLogger.logComponentInteraction(componentName, interactionType, details);
  };

  const getStats = (featureName?: string) => {
    return featureLogger.getFeatureStats(featureName);
  };

  const getHealthChecks = () => {
    return featureLogger.getAllHealthChecks();
  };

  return {
    logFeature,
    logNavigation,
    logApi,
    logComponent,
    getStats,
    getMetrics: () => featureLogger.getMetrics(),
    getHealthChecks,
    exportMetrics: () => featureLogger.exportMetrics(),
    clearMetrics: () => featureLogger.clearOldMetrics(),
  };
}
