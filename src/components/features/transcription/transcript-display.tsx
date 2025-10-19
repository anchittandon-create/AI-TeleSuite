
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, Music, PauseCircle, Phone, Info } from 'lucide-react';
import '@/styles/transcript.css';

type SpeakerType = 'AGENT' | 'USER' | 'EVENT';
interface TranscriptSegment {
  timestamp: string | null;
  speaker: SpeakerType;
  profile?: string;
  text: string;
  eventTag?: string;
}

const EVENT_TAGS = [
  'RINGING',
  'MUSIC',
  'HOLD_TONE',
  'HOLD',
  'IVR_PROMPT',
  'IVR_MENU',
  'IVR',
  'SILENCE',
  'CALL_TRANSFER',
  'BACKGROUND_NOISE',
  'SYSTEM',
  'SYSTEM_EVENT',
  'SYSTEM_MESSAGE',
  'ANNOUNCEMENT',
] as const;

const normalizeEventTag = (tag: string): string => {
  const upper = tag.toUpperCase().replace(/\s+/g, '_');
  const match = EVENT_TAGS.find(eventTag => upper.startsWith(eventTag));
  return match ?? upper;
};

const parseTranscript = (transcript: string): TranscriptSegment[] => {
  const lines = typeof transcript === 'string'
    ? transcript.split('\n').map(line => line.trim()).filter(Boolean)
    : [];

  if (lines.length === 0) {
    return [];
  }

  const segments: TranscriptSegment[] = [];
  let currentTimestamp: string | null = null;
  let currentGroup: TranscriptSegment | null = null;

  const flushCurrentGroup = () => {
    if (currentGroup) {
      segments.push(currentGroup);
      currentGroup = null;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    // Combined [timestamp] SPEAKER format on one line
    const combinedSpeakerMatch = line.match(/^\[(.*?)\]\s*(AGENT|USER)\s*(?:\(([^)]*?)\))?\s*:\s*(.*)$/i);
    if (combinedSpeakerMatch) {
      flushCurrentGroup();
      const [, timestamp, speakerRaw, profileRaw, contentRaw] = combinedSpeakerMatch;
      currentTimestamp = timestamp.trim() || null;
      currentGroup = {
        timestamp: currentTimestamp,
        speaker: speakerRaw.toUpperCase() as SpeakerType,
        profile: profileRaw?.trim(),
        text: contentRaw.trim(),
      };
      return;
    }

    // Combined [timestamp] [EVENT] format on one line
    const combinedEventMatch = line.match(/^\[(.*?)\]\s*\[(.+?)\](.*)$/);
    if (combinedEventMatch) {
      const [, timestamp, tagRaw, remainder] = combinedEventMatch;
      flushCurrentGroup();
      currentTimestamp = timestamp.trim() || null;
      const normalizedTag = normalizeEventTag(tagRaw);
      const recognizedTag = EVENT_TAGS.includes(
        normalizedTag as (typeof EVENT_TAGS)[number]
      );
      const description = remainder.trim().replace(/^-\s*/, '');
      segments.push({
        timestamp: currentTimestamp,
        speaker: 'EVENT',
        eventTag: recognizedTag ? normalizedTag : undefined,
        text: recognizedTag && description
          ? description
          : `[${tagRaw.trim()}]${description ? ` ${description}` : ''}`,
      });
      return;
    }

    // Timestamp only line
    const timestampOnlyMatch = line.match(/^\[(.*?)\]\s*$/);
    if (timestampOnlyMatch) {
      flushCurrentGroup();
      currentTimestamp = timestampOnlyMatch[1].trim() || null;
      return;
    }

    // Speaker line without timestamp
    const speakerMatch = line.match(/^(AGENT|USER)\s*(?:\(([^)]*?)\))?\s*:\s*(.*)$/i);
    if (speakerMatch) {
      flushCurrentGroup();
      const [, speakerRaw, profileRaw, contentRaw] = speakerMatch;
      currentGroup = {
        timestamp: currentTimestamp,
        speaker: speakerRaw.toUpperCase() as SpeakerType,
        profile: profileRaw?.trim(),
        text: contentRaw.trim(),
      };
      return;
    }

    // Event line without timestamp
    const eventMatch = line.match(/^\[(.+?)\](.*)$/);
    if (eventMatch) {
      flushCurrentGroup();
      const [, tagRaw, remainder] = eventMatch;
      const normalizedTag = normalizeEventTag(tagRaw);
      const recognizedTag = EVENT_TAGS.includes(
        normalizedTag as (typeof EVENT_TAGS)[number]
      );
      const description = remainder.trim().replace(/^-\s*/, '');
      segments.push({
        timestamp: currentTimestamp,
        speaker: 'EVENT',
        eventTag: recognizedTag ? normalizedTag : undefined,
        text: recognizedTag && description
          ? description
          : `[${tagRaw.trim()}]${description ? ` ${description}` : ''}`,
      });
      return;
    }

    // Continuation lines for current speaker
    if (currentGroup && currentGroup.speaker !== 'EVENT') {
      currentGroup.text += `\n${line}`;
      return;
    }

    // Fallback: treat as system/event note
    segments.push({
      timestamp: currentTimestamp,
      speaker: 'EVENT',
      text: line,
    });
  });

  flushCurrentGroup();
  return segments;
};

const getEventIcon = (tag?: string) => {
  if (!tag) return <Info size={14} />;
  const normalized = tag.toUpperCase();
  if (normalized.includes('RINGING') || normalized.includes('CALL')) return <Phone size={14} />;
  if (normalized.includes('MUSIC') || normalized.includes('HOLD')) return <Music size={14} />;
  if (normalized.includes('SILENCE')) return <PauseCircle size={14} />;
  if (normalized.includes('IVR')) return <Bot size={14} />;
  if (normalized.includes('BACKGROUND')) return <Info size={14} />;
  return <Info size={14} />;
};

export const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const segments = parseTranscript(transcript);

  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic p-4 text-center">
        Transcript not available or is empty.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {segments.map((segment, index) => {
        if (segment.speaker === 'EVENT') {
          return (
            <div key={index} className="event-line">
              {getEventIcon(segment.eventTag ?? segment.text)}
              <span className="text-xs font-mono">
                {segment.timestamp ? `[${segment.timestamp}] ` : ''}
                {segment.eventTag ? `[${segment.eventTag}]` : ''}
                {segment.eventTag && segment.text ? ' ' : ''}
                {segment.text}
              </span>
            </div>
          );
        }

        const isAgent = segment.speaker === 'AGENT';
        const speakerLabel = isAgent ? 'Agent' : 'Customer';

        return (
          <div
            key={index}
            className={cn(
              'flex items-start gap-3',
              isAgent ? 'agent-line' : 'user-line'
            )}
          >
            {isAgent && (
              <Avatar className="h-8 w-8 shrink-0 border">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot size={18} />
                </AvatarFallback>
              </Avatar>
            )}

            <div
              className={cn(
                'flex flex-col gap-1 max-w-[80%]',
                isAgent ? '' : 'items-end'
              )}
            >
              {segment.timestamp && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                  {segment.timestamp}
                </span>
              )}
              <div
                className={cn(
                  'p-3 rounded-xl shadow-sm text-sm whitespace-pre-wrap break-words leading-relaxed',
                  isAgent
                    ? 'bg-background border text-foreground'
                    : 'bg-accent/80 text-accent-foreground border-accent/20 border'
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">
                  {speakerLabel}
                  {segment.profile ? ` • ${segment.profile}` : ''}
                </p>
                <p>{segment.text}</p>
              </div>
            </div>

            {!isAgent && (
              <Avatar className="h-8 w-8 shrink-0 border">
                <AvatarFallback className="bg-accent text-accent-foreground">
                  <User size={18} />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        );
      })}
    </div>
  );
};
