/**
 * Centralized list of Gemini model identifiers used across the app.
 * COST OPTIMIZED: Using most efficient models for each use case
 */

export const AI_MODELS = {
  /**
   * Fast, cost-efficient model for most tasks (cheapest option)
   * Use for: Simple text generation, basic analysis
   */
  COST_EFFICIENT: 'googleai/gemini-1.5-flash-001',

  /**
   * Balanced model for multimodal tasks when audio/image analysis needed
   * Use sparingly for: Audio transcription, call scoring
   */
  MULTIMODAL_PRIMARY: 'googleai/gemini-1.5-flash-001',

  /**
   * Premium model - USE ONLY when absolutely necessary
   * Reserve for: Complex analysis, critical business logic
   */
  MULTIMODAL_SECONDARY: 'googleai/gemini-1.5-pro-001',

  /**
   * Text-only efficient model for basic operations
   */
  TEXT_ONLY: 'googleai/gemini-1.5-flash-001',

  /**
   * Ultra-efficient model for simple tasks like rebuttal generation
   */
  BASIC_TEXT: 'googleai/gemini-1.5-flash-001',
} as const;

export type AiModelKey = keyof typeof AI_MODELS;
