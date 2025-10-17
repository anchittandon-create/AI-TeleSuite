/**
 * Centralized list of Gemini model identifiers used across the app.
 * Update these constants if model availability changes.
 */

export const AI_MODELS = {
  /**
   * Fast, general-purpose multimodal model (supports text + audio).
   */
  MULTIMODAL_PRIMARY: 'googleai/gemini-2.0-flash',

  /**
   * Higher quality reasoning model that still supports multimodal input.
   */
  MULTIMODAL_SECONDARY: 'googleai/gemini-1.5-pro',

  /**
   * Text-focused fallback when multimodal analysis is unavailable.
   */
  TEXT_ONLY: 'googleai/gemini-2.0-flash',
} as const;

export type AiModelKey = keyof typeof AI_MODELS;
