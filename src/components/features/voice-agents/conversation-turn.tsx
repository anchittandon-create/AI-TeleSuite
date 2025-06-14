
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
  const isTtsPlaceholderUri = typeof turn.audioDataUri === 'string' && 
                             (turn.audioDataUri.startsWith("tts-simulation:") || 
                              turn.audioDataUri.startsWith("tts-api-error:") ||
                              turn.audioDataUri.startsWith("tts-flow-error:") ||
                              turn.audioDataUri.startsWith("tts-input-validation-error:") ||
                              turn.audioDataUri.startsWith("tts-simulation-error:"));
  
  let descriptivePlaceholderText: string | null = null;
  if (isTtsPlaceholderUri) {
    const matchSimulation = turn.audioDataUri!.match(/tts-simulation:\[AI Speaking \((TTS Voice for Profile: (.*?)\) \(Lang: (.*?)\))\]:/);
    const matchApiError = turn.audioDataUri!.match(/tts-api-error:\[(.*?)]:/);
    const matchFlowError = turn.audioDataUri!.match(/tts-flow-error:\[(.*?)]:/);
    const matchValidationError = turn.audioDataUri!.match(/tts-input-validation-error:\[(.*?)]:/);
    const matchSimulationError = turn.audioDataUri!.match(/tts-simulation-error:\[(.*?)]:/);


    if (matchSimulation) {
      const profileId = matchSimulation[2] || "Default";
      const langCode = matchSimulation[3] || "N/A";
      descriptivePlaceholderText = `(AI Voice - Profile: ${profileId}, Lang: ${langCode})`;
    } else if (matchApiError) {
        descriptivePlaceholderText = `(AI TTS API Error: ${matchApiError[1]})`;
    } else if (matchFlowError) {
        descriptivePlaceholderText = `(AI TTS Flow Error: ${matchFlowError[1]})`;
    } else if (matchValidationError) {
        descriptivePlaceholderText = `(AI TTS Input Error: ${matchValidationError[1]})`;
    } else if (matchSimulationError) {
        descriptivePlaceholderText = `(AI TTS Config Error: ${matchSimulationError[1]})`;
    }
     else {
      descriptivePlaceholderText = `(AI Voice Message - Error or Placeholder)`;
    }
  }


  const handlePlayAISpeech = () => {
    if (audioRef.current && isPlayableAudioDataUri) {
      audioRef.current.play().catch(e => {
        console.error("Error playing AI speech:", e);
        toast({variant: "destructive", title:"Audio Playback Error", description: "Could not play AI speech. Ensure browser allows autoplay or check console."});
      });
    } else if (isPlayableAudioDataUri && onPlayAudio) { // Fallback if ref not set but URI is good
        onPlayAudio(turn.audioDataUri!);
    } else if (isTtsPlaceholderUri) {
        toast({variant: "default", title:"Simulated Speech", description: "This is a text representation. Real audio generation might have failed or is not fully configured."});
    }
  };
  
  const handlePlayUserSpeech = () => {
    if (!isAI && turn.audioDataUri && turn.audioDataUri.startsWith("data:audio") && onPlayAudio) {
        onPlayAudio(turn.audioDataUri);
    }
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
          
          {isAI && isPlayableAudioDataUri && (
            <>
              <audio ref={audioRef} src={turn.audioDataUri} className="hidden" preload="auto" />
              <Button
                variant={"ghost"}
                size="xs"
                onClick={handlePlayAISpeech}
                className={cn("mt-1 h-7 text-xs flex items-center", 
                  isAI ? "text-primary hover:bg-primary/10" : "text-primary-foreground hover:bg-primary-foreground/20"
                )}
              >
                <PlayCircle className="mr-1.5 h-4 w-4" /> Play AI Response Audio
              </Button>
            </>
          )}
          
          {isAI && descriptivePlaceholderText && !isPlayableAudioDataUri && (
             <p className={cn("text-xs italic mt-1 flex items-center", isAI ? "text-muted-foreground/80" : "text-primary-foreground/80", descriptivePlaceholderText.toLowerCase().includes("error") ? "text-destructive/90" : "text-blue-500/90" )}>
                {descriptivePlaceholderText.toLowerCase().includes("error") ? <AlertCircle size={12} className="mr-1.5"/> : <Info size={12} className="mr-1.5"/>}
                {descriptivePlaceholderText}
             </p>
          )}

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
