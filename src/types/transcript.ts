/**
 * @fileOverview Canonical transcript types for AI-TeleSuite
 * 
 * This module defines the single source of truth for transcript data structures.
 * All transcript producers (ASR flows, file uploads, live conversations) MUST
 * convert their output to this canonical format using the normalize helper.
 * 
 * All transcript consumers (viewers, scorers, analytics) MUST accept this format.
 * 
 * Design Principles:
 * 1. Turn-based model (not segment-based) - each turn is one speaker's continuous speech
 * 2. Explicit speaker roles (AGENT, USER, SYSTEM) - no ambiguity
 * 3. Optional speaker names - never inject "Unknown" placeholders
 * 4. Precise timestamps in seconds (startS, endS) - for evidence extraction
 * 5. Call-level metadata - duration, participants, language
 */

/**
 * Speaker role classification
 * - AGENT: Company representative (sales, support, operator)
 * - USER: Customer, caller, end-user
 * - SYSTEM: IVR, hold music, automated messages, non-human audio
 */
export type SpeakerRole = 'AGENT' | 'USER' | 'SYSTEM';

/**
 * A single turn in the conversation - one speaker's continuous utterance
 * 
 * Important: 
 * - A turn ends when the speaker changes OR there's a significant pause
 * - speakerName is OPTIONAL - leave undefined if unknown (DO NOT use "Unknown")
 * - text must be verbatim transcription (include filler words, false starts)
 * - Use Roman script for all languages (transliterate Hindi/Tamil/etc)
 */
export interface TranscriptTurn {
  /** Speaker category */
  speaker: SpeakerRole;
  
  /** 
   * Optional speaker name (e.g., "Riya", "John Smith")
   * Leave undefined if unknown - never use "Unknown", "N/A", or placeholders
   */
  speakerName?: string;
  
  /** 
   * Verbatim transcription of spoken words
   * - Include ALL words: fillers (um, uh), repetitions, false starts
   * - Use Roman script only (e.g., "main theek hoon" not "मैं ठीक हूं")
   * - For SYSTEM events, use descriptive text like "[Call ringing - awaiting answer]"
   */
  text: string;
  
  /** Start time in seconds from call beginning */
  startS: number;
  
  /** End time in seconds from call beginning */
  endS: number;
}

/**
 * Complete transcript document with metadata and turns
 * 
 * This is the canonical format for all transcripts in the system.
 * Every transcript producer MUST convert to this format.
 */
export interface TranscriptDoc {
  /** 
   * Array of conversation turns in chronological order
   * Each turn represents one speaker's continuous speech
   */
  turns: TranscriptTurn[];
  
  /** Call-level metadata */
  metadata: {
    /** Total call duration in seconds */
    durationS?: number;
    
    /** Primary language(s) detected (ISO codes: "en", "hi", "hi-en" for Hinglish) */
    language?: string;
    
    /** Name of the agent, if known */
    agentName?: string;
    
    /** Name of the user/customer, if known */
    userName?: string;
    
    /** Sample rate of original audio in Hz */
    sampleRateHz?: number;
    
    /** Timestamp when transcript was created */
    createdAt?: string; // ISO 8601
    
    /** Source of the transcript (e.g., "whisper-asr", "manual-upload", "live-conversation") */
    source?: string;
  };
}

/**
 * Type guard to check if an object is a valid TranscriptDoc
 */
export function isTranscriptDoc(obj: unknown): obj is TranscriptDoc {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const doc = obj as Record<string, unknown>;
  
  // Must have turns array
  if (!Array.isArray(doc.turns)) return false;
  
  // Must have metadata object
  if (typeof doc.metadata !== 'object' || doc.metadata === null) return false;
  
  // Validate each turn has required fields
  return doc.turns.every((turn: unknown) => {
    if (typeof turn !== 'object' || turn === null) return false;
    const t = turn as Record<string, unknown>;
    return (
      (t.speaker === 'AGENT' || t.speaker === 'USER' || t.speaker === 'SYSTEM') &&
      typeof t.text === 'string' &&
      typeof t.startS === 'number' &&
      typeof t.endS === 'number'
    );
  });
}

/**
 * Helper to get duration of a turn in seconds
 */
export function getTurnDuration(turn: TranscriptTurn): number {
  return turn.endS - turn.startS;
}

/**
 * Helper to format timestamp for display (e.g., "1:23" or "12:34")
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper to get speaker display name with fallback
 * Never returns "Unknown" - returns role-based default instead
 */
export function getSpeakerDisplayName(turn: TranscriptTurn): string {
  if (turn.speakerName && turn.speakerName.trim().length > 0) {
    return turn.speakerName;
  }
  
  // Use role-based defaults instead of "Unknown"
  switch (turn.speaker) {
    case 'AGENT':
      return 'Agent';
    case 'USER':
      return 'Customer';
    case 'SYSTEM':
      return 'System';
    default:
      return 'Speaker';
  }
}

/**
 * Helper to filter transcript by speaker role
 */
export function filterByRole(doc: TranscriptDoc, role: SpeakerRole): TranscriptTurn[] {
  return doc.turns.filter(turn => turn.speaker === role);
}

/**
 * Helper to get all unique speakers in the transcript
 */
export function getUniqueSpeakers(doc: TranscriptDoc): Array<{ role: SpeakerRole; name?: string }> {
  const speakers = new Map<string, { role: SpeakerRole; name?: string }>();
  
  for (const turn of doc.turns) {
    const key = turn.speakerName || turn.speaker;
    if (!speakers.has(key)) {
      speakers.set(key, { role: turn.speaker, name: turn.speakerName });
    }
  }
  
  return Array.from(speakers.values());
}
