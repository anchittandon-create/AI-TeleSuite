
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import '@/styles/transcript.css';

export const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const lines = typeof transcript === 'string' ? transcript.split('\n') : [];
  
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
      return <p className="text-sm text-muted-foreground italic p-4 text-center">Transcript not available or is empty.</p>;
  }

  let currentTimestamp: string | null = null;
  const groupedLines: { timestamp: string | null; speaker?: 'AGENT' | 'USER' | 'RINGING:'; text: string; }[] = [];

  // Group lines by speaker under a timestamp
  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    const speakerMatch = trimmedLine.match(/^(AGENT:|USER:|RINGING:)\s*/);

    if (speakerMatch) {
        const speaker = speakerMatch[1] as 'AGENT:' | 'USER:' | 'RINGING:';
        const text = trimmedLine.substring(speakerMatch[0].length);
        groupedLines.push({ timestamp: null, speaker: speaker.replace(':', '') as any, text });
    } else if (trimmedLine.startsWith('[')) {
        // This is a timestamp line, we can ignore it for this display style
    } else if (trimmedLine) {
        // Handle lines without an explicit speaker label (could be continuations)
        const lastGroup = groupedLines[groupedLines.length - 1];
        if(lastGroup && lastGroup.speaker) {
            lastGroup.text += `\n${trimmedLine}`;
        } else {
            // If it doesn't belong to a previous speaker, treat it as a system message or note
            groupedLines.push({ timestamp: null, text: trimmedLine });
        }
    }
  });


  return (
    <div className="space-y-4">
      {groupedLines.map((group, index) => {
        if (!group.speaker) {
          // Render system messages differently
          return (
            <div key={index} className="text-center text-xs text-muted-foreground font-mono py-2">
              {group.text}
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
              <div className="p-3 rounded-xl shadow-sm bg-background border">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{group.text}</p>
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
