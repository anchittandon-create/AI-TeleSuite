"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import '@/styles/transcript.css';

export const TranscriptDisplay = ({ transcript }: { transcript: string }) => {
  const lines = typeof transcript === 'string' ? transcript.split('\n').filter(line => line.trim() !== '') : [];
  
  if (lines.length === 0) {
      return <p className="text-sm text-muted-foreground italic p-4 text-center">Transcript not available or is empty.</p>;
  }

  const groupedLines: { timestamp: string | null; speaker?: 'AGENT' | 'USER'; text: string; }[] = [];
  let currentGroup: { timestamp: string | null; speaker?: 'AGENT' | 'USER'; text: string; } | null = null;

  lines.forEach(line => {
    const timeMatch = line.match(/^\[(.*?)\]/);
    const speakerMatch = line.match(/^(AGENT:|USER:)\s*/i);
    
    if (speakerMatch) {
        // If a new speaker starts, push the previous group.
        if (currentGroup) {
            groupedLines.push(currentGroup);
        }
        // Start a new group for the new speaker.
        const speaker = speakerMatch[1].toUpperCase().replace(':', '') as 'AGENT' | 'USER';
        currentGroup = {
            speaker: speaker,
            text: line.substring(speakerMatch[0].length).trim(),
            timestamp: timeMatch ? timeMatch[1] : null,
        };
    } else if (currentGroup) {
        // If it's a continuation line, append it to the current group's text.
        currentGroup.text += `\n${line.trim()}`;
    } else {
        // This is a line without a speaker before any speaker has been identified (e.g., a timestamp line alone).
        // Push it as a system message.
        groupedLines.push({ text: line.trim(), timestamp: null });
    }
  });

  // Push the very last group if it exists.
  if (currentGroup) {
    groupedLines.push(currentGroup);
  }


  return (
    <div className="space-y-4">
      {groupedLines.map((group, index) => {
        if (!group.speaker) {
          // Render system messages, timestamps, or malformed lines differently
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
