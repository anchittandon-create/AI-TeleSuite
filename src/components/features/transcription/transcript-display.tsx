
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, PhoneIncoming, Music, PauseCircle, Phone, Info } from 'lucide-react';
import '@/styles/transcript.css';

export const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const lines = typeof transcript === 'string' ? transcript.split('\n').filter(line => line.trim() !== '') : [];
  
  if (lines.length === 0) {
      return <p className="text-sm text-muted-foreground italic p-4 text-center">Transcript not available or is empty.</p>;
  }

  const groupedLines: { timestamp: string | null; speaker?: 'AGENT' | 'USER' | 'EVENT'; text: string; }[] = [];
  let currentGroup: { timestamp: string | null; speaker?: 'AGENT' | 'USER' | 'EVENT'; text: string; } | null = null;
  let pendingTimestamp: string | null = null;

  lines.forEach(line => {
    const timeMatch = line.match(/^\[(.*?)\]/);
    const lineWithoutTimestamp = timeMatch ? line.slice(timeMatch[0].length).trimStart() : line.trim();
    const speakerMatch = lineWithoutTimestamp.match(/^(AGENT:|USER:)\s*/i);
    const eventMatch = lineWithoutTimestamp.match(/^\[(RINGING|MUSIC|HOLD_TONE|IVR|SILENCE)\]/i);
    const timeOnlyMatch = line.match(/^\[(.*?)\]\s*$/);

    if (timeOnlyMatch && !lineWithoutTimestamp) {
        pendingTimestamp = timeOnlyMatch[1];
        return;
    }
    
    if (speakerMatch) {
        if (currentGroup) groupedLines.push(currentGroup);
        const speaker = speakerMatch[1].toUpperCase().replace(':', '') as 'AGENT' | 'USER';
        currentGroup = {
            speaker: speaker,
            text: lineWithoutTimestamp.substring(speakerMatch[0].length).trim(),
            timestamp: (timeMatch ? timeMatch[1] : pendingTimestamp) || null,
        };
        pendingTimestamp = null;
    } else if (eventMatch) {
        if (currentGroup) groupedLines.push(currentGroup);
        currentGroup = null; // Reset group for events
        groupedLines.push({
            speaker: 'EVENT',
            text: timeMatch ? line.trim() : lineWithoutTimestamp,
            timestamp: (timeMatch ? timeMatch[1] : pendingTimestamp) || null
        });
        pendingTimestamp = null;
    } else if (currentGroup && currentGroup.speaker !== 'EVENT') {
        currentGroup.text += `\n${line.trim()}`;
    } else {
        // Line without a clear speaker/event, treat as a system message if it's not just a timestamp
        if (!timeMatch) {
            groupedLines.push({ text: line.trim(), timestamp: null, speaker: 'EVENT' });
        }
    }
  });

  if (currentGroup) {
    groupedLines.push(currentGroup);
  }

  const getEventIcon = (text: string) => {
    if (text.includes('RINGING')) return <Phone size={14} />;
    if (text.includes('MUSIC') || text.includes('HOLD_TONE')) return <Music size={14} />;
    if (text.includes('SILENCE')) return <PauseCircle size={14} />;
    if (text.includes('IVR')) return <Bot size={14} />;
    return <Info size={14} />;
  }

  return (
    <div className="space-y-4">
      {groupedLines.map((group, index) => {
        if (group.speaker === 'EVENT' || !group.speaker) {
          return (
            <div key={index} className="event-line">
              {getEventIcon(group.text)}
              <span className="text-xs font-mono">{group.text}</span>
            </div>
          );
        }

        const isAI = group.speaker === 'AGENT';
        
        return (
          <div key={index} className={cn("flex items-start gap-3", isAI ? "agent-line" : "user-line")}>
            {isAI && (
              <Avatar className="h-8 w-8 shrink-0 border">
                <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={18}/></AvatarFallback>
              </Avatar>
            )}
            <div className={cn(
              "flex flex-col gap-1 max-w-[80%]",
              isAI ? "" : "items-end"
            )}>
              <div className={cn(
                "p-3 rounded-xl shadow-sm text-sm whitespace-pre-wrap break-words leading-relaxed",
                isAI ? "bg-background border text-foreground" : "bg-accent/80 text-accent-foreground border-accent/20 border"
              )}>
                <p>{group.text}</p>
              </div>
            </div>
            {!isAI && (
              <Avatar className="h-8 w-8 shrink-0 border">
                <AvatarFallback className="bg-accent text-accent-foreground"><User size={18}/></AvatarFallback>
              </Avatar>
            )}
          </div>
        );
      })}
    </div>
  );
};
