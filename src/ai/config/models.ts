/**
 * Centralized list of managed AI model identifiers used by the paid/working build.
 * These default to Google Gemini family models but can be overridden via env vars.
 */

const PRIMARY_MULTIMODAL_MODEL =
  process.env.GOOGLE_AI_MULTIMODAL_MODEL || 'gemini-1.5-pro-latest';
const SECONDARY_MULTIMODAL_MODEL =
  process.env.GOOGLE_AI_MULTIMODAL_FALLBACK_MODEL || 'gemini-1.5-flash-latest';
const COST_EFFICIENT_MODEL =
  process.env.GOOGLE_AI_TEXT_MODEL || 'gemini-1.5-flash-latest';
const BASIC_TEXT_MODEL =
  process.env.GOOGLE_AI_TEXT_FALLBACK_MODEL || 'gemini-1.5-flash-8b';

export const AI_MODELS = {
  /**
   * Fast, lower-cost model for general text generation tasks.
   */
  COST_EFFICIENT: COST_EFFICIENT_MODEL,

  /**
   * Primary multimodal model (audio + text) for transcription and scoring.
   */
  MULTIMODAL_PRIMARY: PRIMARY_MULTIMODAL_MODEL,

  /**
   * Secondary multimodal model used as a fallback.
   */
  MULTIMODAL_SECONDARY: SECONDARY_MULTIMODAL_MODEL,

  /**
   * Text-only model for pure language tasks when audio is already processed.
   */
  TEXT_ONLY: COST_EFFICIENT_MODEL,

  /**
   * Ultra-lightweight model for quick responses or backup text usage.
   */
  BASIC_TEXT: BASIC_TEXT_MODEL,
} as const;

export type AiModelKey = keyof typeof AI_MODELS;
