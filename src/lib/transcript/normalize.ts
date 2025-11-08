/**
 * @fileOverview Transcript normalization utilities for AI-TeleSuite
 * 
 * This module provides functions to convert diverse transcript formats
 * into the canonical TranscriptDoc format.
 * 
 * Supported input sources:
 * - ASR output (Whisper, Gemini, etc.) with segment arrays
 * - Manual uploads (plain text, formatted text)
 * - Live conversation logs (turn arrays from voice agents)
 * - Legacy segment-based transcripts
 * 
 * CRITICAL RULES:
 * 1. NEVER inject "Unknown", "N/A", or placeholder names
 * 2. Use role-based defaults (Agent/Customer/System) if name unknown
 * 3. Preserve verbatim text (no summarization)
 * 4. Convert all languages to Roman script
 * 5. Merge consecutive turns from same speaker
 * 6. Detect pre-call section (IVR, hold, noise) and set callStartMs
 */

import type { TranscriptDoc, TranscriptTurn, SpeakerRole } from '@/types/transcript';
import { isInteractiveProfile, legacyRoleToProfile } from '@/types/transcript';

/**
 * Legacy segment format from old TranscriptionOutput
 */
interface LegacySegment {
  startSeconds: number;
  endSeconds: number;
  speaker: 'AGENT' | 'USER' | 'SYSTEM';
  speakerProfile?: string;
  text: string;
}

/**
 * Generic segment format (flexible input)
 */
interface GenericSegment {
  start?: number; // seconds
  startSeconds?: number;
  startS?: number;
  end?: number;
  endSeconds?: number;
  endS?: number;
  speaker?: string | SpeakerRole;
  role?: string | SpeakerRole;
  speakerName?: string;
  name?: string;
  profile?: string;
  speakerProfile?: string;
  text: string;
  content?: string;
}

/**
 * Options for normalization
 */
interface NormalizeOptions {
  /** Default agent name if not specified in segments */
  defaultAgentName?: string;
  
  /** Default user name if not specified in segments */
  defaultUserName?: string;
  
  /** Merge consecutive turns from same speaker */
  mergeConsecutiveTurns?: boolean;
  
  /** Source identifier (e.g., "whisper-asr", "manual-upload") */
  source?: string;
  
  /** Language code (e.g., "en", "hi", "hi-en") */
  language?: string;
}

/**
 * Normalize speaker string to SpeakerRole
 */
function normalizeSpeakerRole(speaker: string | SpeakerRole | undefined): SpeakerRole {
  if (!speaker) return 'USER';
  
  const normalized = speaker.toUpperCase().trim();
  
  if (normalized === 'AGENT' || normalized.includes('AGENT')) return 'AGENT';
  if (normalized === 'USER' || normalized.includes('USER') || normalized.includes('CUSTOMER') || normalized.includes('CALLER')) return 'USER';
  if (normalized === 'SYSTEM' || normalized.includes('SYSTEM') || normalized.includes('IVR') || normalized.includes('HOLD')) return 'SYSTEM';
  
  // Default to USER if ambiguous
  return 'USER';
}

/**
 * Extract speaker name from profile string, avoiding placeholders
 * Examples:
 * - "Agent (Riya)" -> "Riya"
 * - "User (John)" -> "John"
 * - "Agent (Unknown)" -> undefined
 * - "IVR" -> undefined
 */
function extractSpeakerName(profile: string | undefined, speaker: SpeakerRole): string | undefined {
  if (!profile || profile.trim().length === 0) return undefined;
  
  const normalized = profile.toLowerCase().trim();
  
  // Reject placeholder names
  const placeholders = ['unknown', 'n/a', 'na', 'unidentified', 'anonymous', 'unnamed', 'not provided'];
  if (placeholders.some(p => normalized === p || normalized.includes(p))) {
    return undefined;
  }
  
  // Reject system identifiers
  if (speaker === 'SYSTEM') return undefined;
  
  // Extract from parentheses: "Agent (Riya)" -> "Riya"
  const parenMatch = profile.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const extracted = parenMatch[1].trim();
    if (extracted.length > 0 && !placeholders.some(p => extracted.toLowerCase().includes(p))) {
      return extracted;
    }
  }
  
  // Use raw profile if it doesn't contain role keywords
  if (!normalized.includes('agent') && !normalized.includes('user') && !normalized.includes('system')) {
    return profile.trim();
  }
  
  return undefined;
}

/**
 * Normalize a single generic segment to TranscriptTurn
 */
function normalizeSegment(segment: GenericSegment, options: NormalizeOptions = {}): TranscriptTurn {
  // Extract timestamps
  const startS = segment.startS ?? segment.startSeconds ?? segment.start ?? 0;
  const endS = segment.endS ?? segment.endSeconds ?? segment.end ?? startS;
  const startMs = startS * 1000;
  const endMs = endS * 1000;
  
  // Extract speaker role
  const speakerStr = segment.speaker ?? segment.role ?? 'USER';
  const speaker = normalizeSpeakerRole(speakerStr);
  
  // Map legacy role to new profile system
  const { profile, baseRole } = legacyRoleToProfile(speaker);
  
  // Extract speaker name (avoid placeholders)
  let speakerName = segment.speakerName ?? segment.name;
  if (!speakerName) {
    speakerName = extractSpeakerName(
      segment.profile ?? segment.speakerProfile,
      speaker
    );
  }
  
  // Apply defaults from options if no name found
  if (!speakerName && speaker === 'AGENT' && options.defaultAgentName) {
    speakerName = options.defaultAgentName;
  }
  if (!speakerName && speaker === 'USER' && options.defaultUserName) {
    speakerName = options.defaultUserName;
  }
  
  // Extract text
  const text = (segment.text ?? segment.content ?? '').trim();
  
  return {
    profile,
    baseRole,
    speaker,
    speakerName,
    text,
    startS,
    endS,
    startMs,
    endMs,
  };
}

/**
 * Merge consecutive turns from the same speaker
 * This is useful when ASR outputs many small segments for one utterance
 */
function mergeConsecutiveTurns(turns: TranscriptTurn[]): TranscriptTurn[] {
  if (turns.length === 0) return [];
  
  const merged: TranscriptTurn[] = [];
  let current = { ...turns[0] };
  
  for (let i = 1; i < turns.length; i++) {
    const next = turns[i];
    
    // Merge if same speaker and same name (or both undefined)
    if (
      current.speaker === next.speaker &&
      current.speakerName === next.speakerName
    ) {
      // Concatenate text with space
      current.text = current.text + ' ' + next.text;
      // Extend end time
      current.endS = next.endS;
    } else {
      // Different speaker, push current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  
  // Push final turn
  merged.push(current);
  
  return merged;
}

/**
 * Main normalization function - converts any transcript format to TranscriptDoc
 * 
 * This is the primary function used by all transcript producers.
 * It handles multiple input formats and always outputs canonical TranscriptDoc.
 */
export function normalizeTranscript(
  input: unknown,
  options: NormalizeOptions = {}
): TranscriptDoc {
  
  // Case 1: Already a TranscriptDoc
  if (input && typeof input === 'object' && 'turns' in input && Array.isArray((input as { turns: unknown[] }).turns)) {
    const doc = input as TranscriptDoc;
    
    // Detect pre-call section if not already detected
    if (doc.callStartMs === undefined && doc.turns.length > 0) {
      const { callStartMs, preCallDurationMs } = detectPreCall(doc);
      const updatedDoc = {
        ...doc,
        callStartMs,
        preCallDurationMs,
      };
      
      // Apply merging if requested
      if (options.mergeConsecutiveTurns) {
        return {
          ...updatedDoc,
          turns: mergeConsecutiveTurns(updatedDoc.turns),
        };
      }
      
      return updatedDoc;
    }
    
    // Apply merging if requested
    if (options.mergeConsecutiveTurns && doc.turns.length > 0) {
      return {
        ...doc,
        turns: mergeConsecutiveTurns(doc.turns),
      };
    }
    
    return doc;
  }
  
  // Case 2: Legacy format with segments array
  if (input && typeof input === 'object' && 'segments' in input && Array.isArray((input as { segments: unknown[] }).segments)) {
    const legacy = input as { segments: GenericSegment[] };
    const turns = legacy.segments.map(seg => normalizeSegment(seg, options));
    
    // Calculate metadata
    const durationS = turns.length > 0 ? Math.max(...turns.map(t => t.endS)) : 0;
    const agentName = options.defaultAgentName ?? turns.find(t => t.speaker === 'AGENT' && t.speakerName)?.speakerName;
    const userName = options.defaultUserName ?? turns.find(t => t.speaker === 'USER' && t.speakerName)?.speakerName;
    
    const finalTurns = options.mergeConsecutiveTurns ? mergeConsecutiveTurns(turns) : turns;
    
    const doc: TranscriptDoc = {
      turns: finalTurns,
      metadata: {
        durationS,
        language: options.language,
        agentName,
        userName,
        source: options.source ?? 'legacy-segments',
        createdAt: new Date().toISOString(),
      },
    };
    
    // Detect pre-call section
    const { callStartMs, preCallDurationMs } = detectPreCall(doc);
    doc.callStartMs = callStartMs;
    doc.preCallDurationMs = preCallDurationMs;
    
    return doc;
  }
  
  // Case 3: Array of segments directly
  if (Array.isArray(input)) {
    const turns = (input as GenericSegment[]).map(seg => normalizeSegment(seg, options));
    
    const durationS = turns.length > 0 ? Math.max(...turns.map(t => t.endS)) : 0;
    const agentName = options.defaultAgentName ?? turns.find(t => t.speaker === 'AGENT' && t.speakerName)?.speakerName;
    const userName = options.defaultUserName ?? turns.find(t => t.speaker === 'USER' && t.speakerName)?.speakerName;
    
    const finalTurns = options.mergeConsecutiveTurns ? mergeConsecutiveTurns(turns) : turns;
    
    const doc: TranscriptDoc = {
      turns: finalTurns,
      metadata: {
        durationS,
        language: options.language,
        agentName,
        userName,
        source: options.source ?? 'array',
        createdAt: new Date().toISOString(),
      },
    };
    
    // Detect pre-call section
    const { callStartMs, preCallDurationMs } = detectPreCall(doc);
    doc.callStartMs = callStartMs;
    doc.preCallDurationMs = preCallDurationMs;
    
    return doc;
  }
  
  // Case 4: Plain text string - parse it
  if (typeof input === 'string') {
    const turns = parseTextTranscript(input, options);
    const durationS = turns.length > 0 ? Math.max(...turns.map(t => t.endS)) : 0;
    
    const doc: TranscriptDoc = {
      turns,
      metadata: {
        durationS,
        language: options.language,
        agentName: options.defaultAgentName,
        userName: options.defaultUserName,
        source: options.source ?? 'text-parse',
        createdAt: new Date().toISOString(),
      },
    };
    
    // Detect pre-call section
    const { callStartMs, preCallDurationMs } = detectPreCall(doc);
    doc.callStartMs = callStartMs;
    doc.preCallDurationMs = preCallDurationMs;
    
    return doc;
  }
  
  // Fallback: empty transcript
  console.warn('Unable to normalize transcript, returning empty document', input);
  return {
    turns: [],
    metadata: {
      source: options.source ?? 'unknown',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Parse plain text transcript into turns
 * Supports formats like:
 * - "[timestamp] AGENT: text"
 * - "AGENT (Name): text"
 * - "Agent: text"
 */
function parseTextTranscript(text: string, options: NormalizeOptions): TranscriptTurn[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const turns: TranscriptTurn[] = [];
  let currentTime = 0;
  const ESTIMATED_WORDS_PER_SECOND = 2.5; // Rough estimate for duration
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Try to extract timestamp [00:12] or [0:12]
    let timestamp: number | undefined;
    const timestampMatch = trimmed.match(/^\[(\d+):(\d+)\]/);
    if (timestampMatch) {
      const [, mins, secs] = timestampMatch;
      timestamp = parseInt(mins) * 60 + parseInt(secs);
    }
    
    // Try to extract speaker
    const speakerMatch = trimmed.match(/^(?:\[\d+:\d+\]\s*)?(AGENT|USER|SYSTEM|Agent|User|Customer|System|IVR)\s*(?:\(([^)]+)\))?\s*:\s*(.+)$/i);
    
    if (speakerMatch) {
      const [, speakerStr, nameStr, textContent] = speakerMatch;
      const speaker = normalizeSpeakerRole(speakerStr);
      const { profile, baseRole } = legacyRoleToProfile(speaker);
      const speakerName = extractSpeakerName(nameStr, speaker);
      
      const wordCount = textContent.split(/\s+/).length;
      const estimatedDuration = wordCount / ESTIMATED_WORDS_PER_SECOND;
      
      const startS = timestamp ?? currentTime;
      const endS = startS + estimatedDuration;
      const startMs = startS * 1000;
      const endMs = endS * 1000;
      
      turns.push({
        profile,
        baseRole,
        speaker,
        speakerName,
        text: textContent.trim(),
        startS,
        endS,
        startMs,
        endMs,
      });
      
      currentTime = endS;
    }
  }
  
  return options.mergeConsecutiveTurns ? mergeConsecutiveTurns(turns) : turns;
}

/**
 * Convert TranscriptDoc to plain text format for export
 */
export function transcriptToText(doc: TranscriptDoc, includeTimestamps = true): string {
  let text = '';
  
  for (const turn of doc.turns) {
    const timestamp = includeTimestamps ? `[${formatTime(turn.startS)}] ` : '';
    const speaker = turn.speakerName || turn.speaker;
    text += `${timestamp}${speaker}: ${turn.text}\n`;
  }
  
  return text;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper to convert legacy TranscriptionOutput to TranscriptDoc
 */
export function legacyTranscriptionToDoc(
  legacy: { segments: LegacySegment[] },
  options: NormalizeOptions = {}
): TranscriptDoc {
  return normalizeTranscript(legacy, options);
}

/**
 * Detect pre-call section by finding the first interactive turn
 * Returns the index where the actual conversation starts and pre-call duration
 */
export function detectPreCall(doc: TranscriptDoc): {
  callStartIndex: number;
  callStartMs?: number;
  preCallDurationMs: number;
} {
  // Find first interactive profile (agent or customer)
  const callStartIndex = doc.turns.findIndex(t => isInteractiveProfile(t.profile));
  
  if (callStartIndex === -1) {
    // Entire document is pre-call (no interactive conversation)
    const lastTurn = doc.turns[doc.turns.length - 1];
    const totalMs = lastTurn ? (lastTurn.endMs ?? lastTurn.endS * 1000) : 0;
    return { 
      callStartIndex: 0, 
      callStartMs: undefined,
      preCallDurationMs: totalMs 
    };
  }
  
  if (callStartIndex === 0) {
    // No pre-call section
    return { 
      callStartIndex: 0, 
      callStartMs: 0,
      preCallDurationMs: 0 
    };
  }
  
  // Calculate call start time and pre-call duration
  const callStartTurn = doc.turns[callStartIndex];
  const callStartMs = callStartTurn.startMs ?? callStartTurn.startS * 1000;
  
  const firstTurn = doc.turns[0];
  const firstMs = firstTurn.startMs ?? firstTurn.startS * 1000;
  
  const preCallDurationMs = Math.max(0, callStartMs - firstMs);
  
  return { callStartIndex, callStartMs, preCallDurationMs };
}

/**
 * Filter transcript for scoring by removing pre-call profiles
 * Pre-call content (IVR, hold, noise, etc.) should not affect scoring
 */
export function filterForScoring(doc: TranscriptDoc): TranscriptDoc {
  const interactiveTurns = doc.turns.filter(t => isInteractiveProfile(t.profile));
  
  // Recalculate duration based on filtered turns
  const durationS = interactiveTurns.length > 0 
    ? Math.max(...interactiveTurns.map(t => t.endS)) 
    : 0;
  
  return {
    ...doc,
    turns: interactiveTurns,
    // Reset pre-call metadata since we've filtered it out
    callStartMs: undefined,
    preCallDurationMs: 0,
    metadata: {
      ...doc.metadata,
      durationS,
    },
  };
}
