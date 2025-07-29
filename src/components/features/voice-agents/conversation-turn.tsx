
"use client";

import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, User, Bot } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUriOrVoiceId: string, textToPlay: string) => void;
}

export function ConversationTurn({ turn, onPlayAudio }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';
  const { toast } = useToast();

  const isPlayableAudio = turn.audioDataUri ? (turn.audioDataUri.startsWith("data:audio/") || turn.audioDataUri.startsWith("blob:")) : false;

  const handlePlayAudio = () => {
    if (onPlayAudio) {
      onPlayAudio(turn.audioDataUri!, turn.text);
    } else {
      toast({ variant: "default", title: "Playback Unavailable", description: "The audio player for this turn is not configured." });
    }
  };


  return (
    <div className={cn("flex items-start gap-2 my-3", isAI ? "justify-start" : "justify-end")}>
      {isAI && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot size={18}/>
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col gap-1", isAI ? "items-start" : "items-end")}>
        <Card className={cn(
          "max-w-full w-fit p-3 rounded-xl shadow-sm",
          isAI ? "bg-secondary rounded-bl-none" : "bg-primary text-primary-foreground rounded-br-none"
        )}>
          <CardContent className="p-0">
            <p className="text-sm whitespace-pre-wrap break-words">{turn.text}</p>
          </CardContent>
        </Card>
         <div className="flex items-center gap-2">
            {isAI && turn.audioDataUri && (
                <Button variant="ghost" size="xs" onClick={handlePlayAudio} className={cn("h-6 text-xs", "text-muted-foreground")}>
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5"/> Play Audio
                </Button>
            )}
            <p className={cn(
                "text-xs opacity-60",
                isAI ? "text-muted-foreground" : "text-primary-foreground/80"
            )}>
                {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
         </div>
      </div>
      {!isAI && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-accent text-accent-foreground">
            <User size={18}/>
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
