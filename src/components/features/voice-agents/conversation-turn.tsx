
"use client";

import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, User, Bot, PauseCircle } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUri: string, turnId: string) => void;
  currentlyPlayingId?: string | null;
  wordIndex?: number;
}

export function ConversationTurn({ turn, onPlayAudio, currentlyPlayingId, wordIndex = -1 }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';
  const { toast } = useToast();

  const isPlayableAudio = turn.audioDataUri && turn.audioDataUri.startsWith("data:audio/");
  const isCurrentlyPlaying = turn.id === currentlyPlayingId;

  const handlePlayAudio = () => {
    if (isPlayableAudio && onPlayAudio) {
      onPlayAudio(turn.audioDataUri!, turn.id);
    } else {
      toast({ variant: "default", title: "Playback Unavailable", description: "Audio for this turn is not available." });
    }
  };

  const words = turn.text.split(/(\s+)/); // Split by space, keeping spaces

  return (
    <div className={cn("flex items-start gap-2.5 my-3", isAI ? "" : "justify-end")}>
      {isAI && (
          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground"><Bot size={18}/></AvatarFallback></Avatar>
      )}
       <div className={cn("flex flex-col gap-1 w-full", isAI ? "max-w-[80%]" : "max-w-[80%] items-end")}>
        <div className={cn("flex items-center space-x-2", isAI ? "justify-start" : "justify-end")}>
             <span className="text-xs font-semibold text-foreground/80">{turn.speaker}</span>
             <span className="text-xs text-muted-foreground font-mono">
                {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </span>
        </div>
        <Card className={cn(
            "max-w-full w-fit p-3 rounded-xl shadow-sm",
            isAI ? "bg-muted/50 rounded-bl-none" : "bg-accent text-accent-foreground rounded-br-none"
        )}>
            <CardContent className="p-0 text-sm">
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {isCurrentlyPlaying && wordIndex > -1 ? (
                        words.map((word, i) => (
                            <span key={i} className={cn(
                              'transition-colors duration-150',
                               i === wordIndex ? (isAI ? 'text-primary font-bold' : 'text-white font-bold') : (isAI ? 'text-foreground' : 'text-accent-foreground/90')
                            )}>
                                {word}
                            </span>
                        ))
                    ) : (
                         <span className={cn(isAI ? 'text-foreground' : 'text-accent-foreground')}>{turn.text}</span>
                    )}
                </p>
            </CardContent>
        </Card>
        {isAI && isPlayableAudio && (
             <Button variant="ghost" size="xs" onClick={handlePlayAudio} className={cn("h-6 text-xs pl-1 pr-2", "text-muted-foreground")}>
                   {isCurrentlyPlaying ? <PauseCircle className="mr-1.5 h-3.5 w-3.5"/> : <PlayCircle className="mr-1.5 h-3.5 w-3.5"/>}
                   {isCurrentlyPlaying ? "Pause" : "Play"}
               </Button>
        )}
      </div>
      {!isAI && (
          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-accent text-accent-foreground"><User size={18}/></AvatarFallback></Avatar>
      )}
    </div>
  );
}
