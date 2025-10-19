"use client";

import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { User, Bot } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from "@/lib/utils";

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUri: string, turnId: string) => void;
  currentlyPlayingId?: string | null;
  wordIndex?: number;
}

export function ConversationTurn({ turn, onPlayAudio, currentlyPlayingId, wordIndex = -1 }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';

  const isPlayableAudio = turn.audioDataUri && turn.audioDataUri.startsWith("data:audio/");
  const isCurrentlyPlaying = turn.id === currentlyPlayingId;

  const words = turn.text.split(/(\s+)/); // Maintain original spacing
  let progressiveWordIndex = -1;

  return (
    <div className={cn(
      "flex items-start gap-2.5 my-3", 
      isAI ? "agent-line" : "user-line"
    )}>
      {isAI && (
          <Avatar className="h-8 w-8 shrink-0 border">
            <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={18}/></AvatarFallback>
          </Avatar>
      )}
       <div className={cn(
          "flex flex-col gap-1 w-full",
          isAI ? "max-w-[80%]" : "max-w-[80%] items-end"
       )}>
        <div className={cn("flex items-center space-x-2", isAI ? "justify-start" : "justify-end")}>
             <span className={cn("text-xs font-semibold", isAI ? 'text-primary' : 'text-accent-foreground')}>{turn.speaker}</span>
             <span className="text-xs text-muted-foreground font-mono">
                {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </span>
        </div>
        <Card className={cn(
            "max-w-full w-fit p-3 rounded-xl shadow-sm",
            isAI 
              ? "bg-muted/50 rounded-bl-none text-foreground" 
              : "bg-accent/80 text-accent-foreground rounded-br-none"
        )}>
            <CardContent className="p-0 text-sm">
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {isCurrentlyPlaying && wordIndex > -1 ? (
                      words.map((word, i) => {
                        const trimmed = word.trim();
                        if (trimmed.length > 0) {
                          progressiveWordIndex += 1;
                        }
                        const isHighlighted =
                          trimmed.length > 0 && progressiveWordIndex <= wordIndex;
                        return (
                          <span
                            key={i}
                            className={cn(
                              'transition-all duration-150 rounded-sm',
                              isHighlighted
                                ? (isAI ? 'bg-primary/20' : 'bg-background/20')
                                : 'bg-transparent'
                            )}
                          >
                            {word}
                          </span>
                        );
                      })
                    ) : (
                      <span>{turn.text}</span>
                    )}
                </p>
            </CardContent>
        </Card>
      </div>
      {!isAI && (
          <Avatar className="h-8 w-8 shrink-0 border">
            <AvatarFallback className="bg-accent text-accent-foreground"><User size={18}/></AvatarFallback>
          </Avatar>
      )}
    </div>
  );
}
