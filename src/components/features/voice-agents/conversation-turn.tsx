
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, User, Bot, AlertCircle, Radio } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from '@/lib/utils';

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUri: string) => void;
}

const SIMULATED_AUDIO_PREFIX = "SIMULATED_AUDIO_PLACEHOLDER:";

export function ConversationTurn({ turn, onPlayAudio }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';
  const isSimulatedAISpeech = typeof turn.audioDataUri === 'string' && turn.audioDataUri.startsWith(SIMULATED_AUDIO_PREFIX);
  const actualPlayableAudio = typeof turn.audioDataUri === 'string' && turn.audioDataUri.startsWith("data:audio");

  let simulatedSpeechText: string | null = null;
  if (isSimulatedAISpeech) {
    simulatedSpeechText = turn.audioDataUri!.substring(SIMULATED_AUDIO_PREFIX.length);
  }

  return (
    <div className={cn("flex items-end gap-2 my-3", isAI ? "justify-start" : "justify-end")}>
      {isAI && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot size={18}/>
          </AvatarFallback>
        </Avatar>
      )}
      <Card className={cn(
        "max-w-[75%] p-3 rounded-xl shadow-sm",
        isAI ? "bg-secondary rounded-bl-none" : "bg-primary text-primary-foreground rounded-br-none"
      )}>
        <CardContent className="p-0 space-y-1.5">
          <p className="text-sm whitespace-pre-wrap break-words">{turn.text}</p>
          
          {actualPlayableAudio && onPlayAudio && (
            <Button
              variant={isAI ? "outline" : "secondary"}
              size="xs"
              onClick={() => onPlayAudio(turn.audioDataUri!)}
              className={cn("mt-1 h-7 text-xs", isAI ? "border-primary/30 text-primary hover:bg-primary/10" : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" )}
            >
              <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Play User Audio
            </Button>
          )}

          {isSimulatedAISpeech && simulatedSpeechText && (
             <p className={cn("text-xs italic mt-1 flex items-center", isAI ? "text-muted-foreground/80" : "text-primary-foreground/80")}>
                <Radio size={12} className="mr-1.5 animate-pulse text-accent"/> {simulatedSpeechText}
             </p>
           )}
           
           {turn.speaker === 'User' && turn.transcriptionAccuracy && (
             <p className={cn("text-xs italic mt-1 opacity-70", isAI ? "text-muted-foreground" : "text-primary-foreground/80")}>
                (Transcription Accuracy: {turn.transcriptionAccuracy})
             </p>
           )}

          <p className={cn(
            "text-xs opacity-60 pt-1 text-right",
            isAI ? "text-muted-foreground" : "text-primary-foreground/80"
          )}>
            {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </CardContent>
      </Card>
      {!isAI && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-accent text-accent-foreground">
            <User size={18}/>
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
