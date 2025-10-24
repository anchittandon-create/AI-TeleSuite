/**
 * Smart AI Request Prioritization System
 * Automatically assigns priority levels to minimize costs
 */

export enum RequestPriority {
  CRITICAL = 5,     // Real-time user interactions
  HIGH = 4,         // Important business operations  
  NORMAL = 3,       // Standard operations
  LOW = 2,          // Background processing
  BATCH = 1         // Bulk operations (can wait)
}

export interface CostOptimizedRequest {
  operation: string;
  modelPreference: 'cost_efficient' | 'balanced' | 'premium';
  cacheable: boolean;
  retryable: boolean;
  timeoutMs: number;
  priority: RequestPriority;
}

/**
 * Cost optimization rules for different request types
 */
export const REQUEST_COST_PROFILES: Record<string, CostOptimizedRequest> = {
  // High-frequency, cost-sensitive operations
  'pitch-generation': {
    operation: 'pitch-generation',
    modelPreference: 'cost_efficient',
    cacheable: true,
    retryable: true,
    timeoutMs: 30000,
    priority: RequestPriority.NORMAL
  },

  'rebuttal-generation': {
    operation: 'rebuttal-generation', 
    modelPreference: 'cost_efficient',
    cacheable: true,
    retryable: true,
    timeoutMs: 20000,
    priority: RequestPriority.LOW
  },

  'product-description': {
    operation: 'product-description',
    modelPreference: 'cost_efficient',
    cacheable: true,
    retryable: true,
    timeoutMs: 25000,
    priority: RequestPriority.LOW
  },

  // Medium-cost operations
  'call-scoring': {
    operation: 'call-scoring',
    modelPreference: 'balanced',
    cacheable: true,
    retryable: true,
    timeoutMs: 60000,
    priority: RequestPriority.HIGH
  },

  'transcription': {
    operation: 'transcription',
    modelPreference: 'balanced',
    cacheable: true,
    retryable: false, // Audio files are large, avoid retries
    timeoutMs: 120000,
    priority: RequestPriority.HIGH
  },

  // High-cost operations (use sparingly)
  'voice-agent-conversation': {
    operation: 'voice-agent-conversation',
    modelPreference: 'premium',
    cacheable: false, // Real-time, context-dependent
    retryable: true,
    timeoutMs: 45000,
    priority: RequestPriority.CRITICAL
  },

  'combined-analysis': {
    operation: 'combined-analysis',
    modelPreference: 'premium',
    cacheable: true,
    retryable: true,
    timeoutMs: 90000,
    priority: RequestPriority.HIGH
  },

  // Batch operations (lowest priority)
  'data-analysis': {
    operation: 'data-analysis',
    modelPreference: 'cost_efficient',
    cacheable: true,
    retryable: true,
    timeoutMs: 180000,
    priority: RequestPriority.BATCH
  },

  'training-deck-generation': {
    operation: 'training-deck-generation',
    modelPreference: 'balanced',
    cacheable: true,
    retryable: true,
    timeoutMs: 90000,
    priority: RequestPriority.BATCH
  }
};

/**
 * Get cost-optimized settings for a request type
 */
export function getCostOptimizedProfile(operationType: string): CostOptimizedRequest {
  return REQUEST_COST_PROFILES[operationType] || {
    operation: operationType,
    modelPreference: 'cost_efficient',
    cacheable: true,
    retryable: true,
    timeoutMs: 30000,
    priority: RequestPriority.NORMAL
  };
}

/**
 * Calculate estimated cost for a request (relative units)
 */
export function estimateRequestCost(
  operationType: string,
  inputSize: number = 1000
): number {
  const profile = getCostOptimizedProfile(operationType);
  
  let baseCost = 1;
  
  // Model cost multipliers
  switch (profile.modelPreference) {
    case 'cost_efficient': baseCost *= 1; break;
    case 'balanced': baseCost *= 2.5; break;
    case 'premium': baseCost *= 5; break;
  }
  
  // Input size factor (linear relationship)
  const sizeFactor = Math.max(1, inputSize / 1000);
  
  return Math.round(baseCost * sizeFactor * 100) / 100;
}