
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
    <div className={cn("flex flex-col gap-1 my-3", isAI ? "items-start" : "items-end")}>
       <div className={cn(
        "text-xs font-mono pt-3 block",
        isAI ? "text-primary font-semibold" : "text-green-700 font-semibold"
       )}>
        {turn.speaker}:
       </div>
       <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-6">
           {isCurrentlyPlaying && wordIndex > -1 ? (
               words.map((word, i) => (
                   <span key={i} className={cn(i <= wordIndex ? 'font-semibold bg-primary/20' : 'transition-colors duration-300')}>
                       {word}
                   </span>
               ))
           ) : (
               turn.text
           )}
       </p>
       <div className="flex items-center gap-2 mt-1">
           {isAI && turn.audioDataUri && isPlayableAudio && (
               <Button variant="ghost" size="xs" onClick={handlePlayAudio} className={cn("h-6 text-xs", "text-muted-foreground")}>
                   {isCurrentlyPlaying ? <PauseCircle className="mr-1.5 h-3.5 w-3.5"/> : <PlayCircle className="mr-1.5 h-3.5 w-3.5"/>}
                   {isCurrentlyPlaying ? "Pause" : "Play"}
               </Button>
           )}
           <p className="text-xs text-muted-foreground/80 font-mono">
               {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
           </p>
       </div>
    </div>
  );
}
