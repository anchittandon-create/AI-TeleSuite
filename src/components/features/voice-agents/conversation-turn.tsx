
"use client";

import React, { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, User, Bot, PlayCircle, AlertCircle, Info } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUri: string) => void; 
}

export function ConversationTurn({ turn, onPlayAudio }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const isPlayableAudioDataUri = typeof turn.audioDataUri === 'string' && turn.audioDataUri.startsWith("data:audio");
  const isTtsSimulationUri = typeof turn.audioDataUri === 'string' && turn.audioDataUri.startsWith("tts-simulation:");

  const handlePlayAISpeech = () => {
    if (audioRef.current && isPlayableAudioDataUri) {
      audioRef.current.play().catch(e => {
        console.error("Error playing AI speech:", e);
        toast({variant: "destructive", title:"Audio Playback Error", description: "Could not play AI speech. Ensure browser allows autoplay or check console."});
      });
    }
  };
  
  const handlePlayUserSpeech = () => {
    if (!isAI && turn.audioDataUri && turn.audioDataUri.startsWith("data:audio") && onPlayAudio) {
        onPlayAudio(turn.audioDataUri);
    }
  }

  // Attempt to autoplay AI speech if it's a new AI turn with playable audio
  // useEffect(() => {
  //   if (isAI && isPlayableAudioDataUri && audioRef.current && turn.id !== 'initial-placeholder') {
  //      Consider if autoplay is desired. For now, manual play via button.
  //      handlePlayAISpeech();
  //   }
  // }, [turn.id, isAI, isPlayableAudioDataUri]);


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
          
          {/* For AI's speech - if it's real audio */}
          {isAI && isPlayableAudioDataUri && (
            <>
              <audio ref={audioRef} src={turn.audioDataUri} className="hidden" />
              <Button
                variant={"ghost"}
                size="xs"
                onClick={handlePlayAISpeech}
                className={cn("mt-1 h-7 text-xs flex items-center", 
                  "text-primary hover:bg-primary/10"
                )}
              >
                <PlayCircle className="mr-1.5 h-4 w-4" /> Play AI Response Audio
              </Button>
            </>
          )}
          
          {/* For AI's speech - if it's the tts-simulation placeholder */}
          {isAI && isTtsSimulationUri && (
             <p className={cn("text-xs italic mt-1 flex items-center", "text-muted-foreground/80")}>
                <Info size={12} className="mr-1.5 text-blue-500"/> 
                {turn.audioDataUri.substring("tts-simulation:".length).replace(/^\[AI Speaking\s*/, '[Voice: ').replace(/\)$/,')')}
             </p>
          )}

          {/* For User's speech - if user audio playback was implemented */}
          {!isAI && turn.audioDataUri && turn.audioDataUri.startsWith("data:audio") && onPlayAudio && (
            <Button
              variant={"secondary"}
              size="xs"
              onClick={handlePlayUserSpeech}
              className={cn("mt-1 h-7 text-xs", "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" )}
            >
              <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Play User Audio
            </Button>
          )}
           
           {turn.speaker === 'User' && turn.transcriptionAccuracy && (
             <p className={cn("text-xs italic mt-1 opacity-70", "text-primary-foreground/80")}>
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

