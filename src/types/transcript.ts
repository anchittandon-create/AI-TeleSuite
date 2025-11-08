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
 * Base role for color/scoring purposes
 * - agent: Company representatives
 * - user: Customers, callers
 */
export type BaseRole = 'agent' | 'user';

/**
 * Detailed speaker profile classification
 * Interactive profiles: agent, customer (included in scoring)
 * Pre-call profiles: ivr, system, hold, waiting, noise, peerAgent, supervisor, other (excluded from scoring)
 */
export type Profile =
  | 'agent'        // Interactive: Company agent speaking to customer
  | 'customer'     // Interactive: Customer/caller speaking
  | 'ivr'          // Pre-call: IVR system, automated prompts
  | 'system'       // Pre-call: System messages, notifications
  | 'hold'         // Pre-call: Hold music, waiting messages
  | 'waiting'      // Pre-call: Ringback, awaiting answer
  | 'noise'        // Pre-call: Background noise, unclear audio
  | 'peerAgent'    // Pre-call: Agent talking to another agent
  | 'supervisor'   // Pre-call: Supervisor instructions to agent
  | 'other';       // Pre-call: Other non-interactive audio

/**
 * Legacy speaker role for backward compatibility
 * @deprecated Use Profile and BaseRole instead
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
  /** Detailed speaker profile */
  profile: Profile;
  
  /** Base role for color/scoring purposes */
  baseRole: BaseRole;
  
  /** 
   * Legacy speaker role for backward compatibility
   * @deprecated Use profile and baseRole instead
   */
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
  
  /** Start time in milliseconds from recording start */
  startMs?: number;
  
  /** End time in milliseconds from recording start */
  endMs?: number;
  
  /** Legacy: Start time in seconds (deprecated, use startMs) */
  startS: number;
  
  /** Legacy: End time in seconds (deprecated, use endMs) */
  endS: number;
  
  /** Optional: Confidence score (0-1) from ASR */
  confidence?: number;
  
  /** Optional: Audio channel number */
  channel?: number | string;
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
  
  /** Source of the transcript */
  source?: string;
  
  /** 
   * Timestamp (in ms) when actual interactive conversation begins
   * Undefined if entire transcript is pre-call or no timestamps available
   */
  callStartMs?: number;
  
  /**
   * Total duration (in ms) of pre-call section
   * Includes IVR, hold music, ringback, peer chatter, etc.
   */
  preCallDurationMs?: number;
  
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
  
  // Use profile-based defaults instead of "Unknown"
  switch (turn.profile) {
    case 'agent':
      return 'Agent';
    case 'customer':
      return 'Customer';
    case 'ivr':
      return 'IVR';
    case 'system':
      return 'System';
    case 'hold':
      return 'On Hold';
    case 'waiting':
      return 'Waiting';
    case 'noise':
      return 'Background';
    case 'peerAgent':
      return 'Agent (Internal)';
    case 'supervisor':
      return 'Supervisor';
    case 'other':
      return 'Other';
    default:
      // Fallback to legacy speaker role
      return turn.speaker === 'AGENT' ? 'Agent' : turn.speaker === 'USER' ? 'Customer' : 'System';
  }
}

/**
 * Check if a profile is interactive (included in scoring)
 */
export function isInteractiveProfile(profile: Profile): boolean {
  return profile === 'agent' || profile === 'customer';
}

/**
 * Check if a profile is pre-call (excluded from scoring)
 */
export function isPreCallProfile(profile: Profile): boolean {
  return !isInteractiveProfile(profile);
}

/**
 * Map legacy SpeakerRole to Profile and BaseRole
 */
export function legacyRoleToProfile(speaker: SpeakerRole): { profile: Profile; baseRole: BaseRole } {
  switch (speaker) {
    case 'AGENT':
      return { profile: 'agent', baseRole: 'agent' };
    case 'USER':
      return { profile: 'customer', baseRole: 'user' };
    case 'SYSTEM':
      return { profile: 'system', baseRole: 'user' }; // System events treated as user-side for layout
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
