
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

  const groupedLines: { timestamp: string | null; speaker?: 'AGENT' | 'USER'; text: string; }[] = [];

  // New robust parsing logic
  let currentSpeaker: 'AGENT' | 'USER' | null = null;
  let currentText = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const speakerMatch = trimmedLine.match(/^(AGENT:|USER:)\s*/i);
    
    if (speakerMatch) {
      // If there's a pending message, push it before starting a new one.
      if (currentSpeaker && currentText) {
        groupedLines.push({ timestamp: null, speaker: currentSpeaker, text: currentText.trim() });
      }
      
      currentSpeaker = speakerMatch[1].toUpperCase().replace(':', '') as 'AGENT' | 'USER';
      currentText = trimmedLine.substring(speakerMatch[0].length);
    } else if (trimmedLine.startsWith('[')) {
      // This is a timestamp line, we ignore it for this visual display.
    } else if (currentSpeaker) {
      // This line is a continuation of the previous speaker's dialogue.
      currentText += `\n${trimmedLine}`;
    } else {
       // This line has no speaker and there's no current speaker context.
       // Treat it as a system message.
        if (currentText) { // Push any lingering text first
            groupedLines.push({ timestamp: null, text: currentText.trim() });
            currentText = '';
        }
       groupedLines.push({ timestamp: null, text: trimmedLine });
    }
  });

  // Push the very last message if it exists
  if (currentSpeaker && currentText) {
    groupedLines.push({ timestamp: null, speaker: currentSpeaker, text: currentText.trim() });
  } else if (currentText) { // Handle case where there's text but no speaker
    groupedLines.push({ timestamp: null, text: currentText.trim() });
  }

  return (
    <div className="space-y-4">
      {groupedLines.map((group, index) => {
        if (!group.speaker) {
          // Render system messages or malformed lines differently
          return (
            <div key={index} className="text-center text-xs text-muted-foreground font-mono py-2 italic">
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
