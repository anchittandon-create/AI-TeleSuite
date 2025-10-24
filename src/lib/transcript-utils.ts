/**
 * Utilities for formatting transcription output
 */

import type { TranscriptionOutput } from '@/types';

/**
 * Converts TranscriptionOutput segments to formatted diarized transcript string
 * Format: [timestamp range]\nSpeakerProfile: text
 */
export function formatTranscriptSegments(output: TranscriptionOutput): string {
  if (!output?.segments || output.segments.length === 0) {
    return '';
  }

  return output.segments
    .map((segment) => {
      // Format timestamp range
      const startTime = formatSeconds(segment.startSeconds);
      const endTime = formatSeconds(segment.endSeconds);
      const timeRange = `[${startTime} - ${endTime}]`;

      // Format speaker line with profile
      const speakerLine = `${segment.speakerProfile}: ${segment.text}`;

      return `${timeRange}\n${speakerLine}`;
    })
    .join('\n\n');
}

/**
 * Format seconds to readable time string
 * Examples: 5 -> "5 seconds", 65 -> "1 minute 5 seconds", 125 -> "2 minutes 5 seconds"
 */
function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (minutes === 0) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  if (seconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Extract plain text from transcript (without timestamps or speaker labels)
 * Useful for copying or exporting just the dialogue
 */
export function extractPlainText(output: TranscriptionOutput, includeSpeakers = true): string {
  if (!output?.segments || output.segments.length === 0) {
    return '';
  }

  return output.segments
    .map((segment) => {
      if (includeSpeakers) {
        return `${segment.speakerProfile}: ${segment.text}`;
      }
      return segment.text;
    })
    .join('\n');
}

/**
 * Get transcript summary as formatted text
 */
export function formatTranscriptSummary(output: TranscriptionOutput): string {
  if (!output?.summary) {
    return '';
  }

  const parts: string[] = [];

  if (output.summary.overview) {
    parts.push(`Overview:\n${output.summary.overview}`);
  }

  if (output.summary.keyPoints && output.summary.keyPoints.length > 0) {
    parts.push(`\nKey Points:\n${output.summary.keyPoints.map(point => `• ${point}`).join('\n')}`);
  }

  if (output.summary.actions && output.summary.actions.length > 0) {
    parts.push(`\nAction Items:\n${output.summary.actions.map(action => `• ${action}`).join('\n')}`);
  }

  return parts.join('\n');
}

/**
 * Get full formatted transcript with summary
 */
export function formatFullTranscript(output: TranscriptionOutput): string {
  const segments = formatTranscriptSegments(output);
  const summary = formatTranscriptSummary(output);

  if (!summary) {
    return segments;
  }

  return `${segments}\n\n${'='.repeat(80)}\nSUMMARY\n${'='.repeat(80)}\n\n${summary}`;
}

/**
 * Get transcript metadata
 */
export function getTranscriptMetadata(output: TranscriptionOutput): {
  duration: string;
  segmentCount: number;
  speakerCount: number;
  systemEventCount: number;
} {
  const duration = output.callMeta.durationSeconds
    ? formatSeconds(output.callMeta.durationSeconds)
    : 'Unknown';

  const segmentCount = output.segments.length;

  const uniqueSpeakers = new Set(
    output.segments
      .filter(s => s.speaker !== 'SYSTEM')
      .map(s => s.speakerProfile)
  );
  const speakerCount = uniqueSpeakers.size;

  const systemEventCount = output.segments.filter(s => s.speaker === 'SYSTEM').length;

  return {
    duration,
    segmentCount,
    speakerCount,
    systemEventCount,
  };
}
