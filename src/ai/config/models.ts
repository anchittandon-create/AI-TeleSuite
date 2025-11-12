/**
 * Centralized list of FREE OPEN SOURCE model identifiers used across the app.
 * FREE VERSION: Using open source models via Hugging Face free inference API
 */

export const AI_MODELS = {
  /**
   * Fast, free model for text generation tasks
   * Use for: Simple text generation, basic analysis
   */
  COST_EFFICIENT: 'mistralai/Mistral-7B-Instruct-v0.1',

  /**
   * Primary model for multimodal tasks (FREE via Hugging Face)
   * Use for: Text generation, conversation
   */
  MULTIMODAL_PRIMARY: 'mistralai/Mistral-7B-Instruct-v0.1',

  /**
   * Fallback model - ALSO FREE open source
   * Only use when primary model fails
   */
  MULTIMODAL_SECONDARY: 'microsoft/DialoGPT-medium',

  /**
   * Text-only efficient model for basic operations (FREE)
   */
  TEXT_ONLY: 'mistralai/Mistral-7B-Instruct-v0.1',

  /**
   * Ultra-efficient model for simple tasks (FREE)
   */
  BASIC_TEXT: 'microsoft/DialoGPT-medium',
} as const;

export type AiModelKey = keyof typeof AI_MODELS;
