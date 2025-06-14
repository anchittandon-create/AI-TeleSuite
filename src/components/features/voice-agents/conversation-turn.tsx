
"use client";

import React, { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, User, Bot, PlayCircle, AlertCircle } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUri: string) => void; // Kept for user's audio if ever implemented
}

export function ConversationTurn({ turn, onPlayAudio }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const isPlayableAudioDataUri = typeof turn.audioDataUri === 'string' && turn.audioDataUri.startsWith("data:audio");
  
  // This is for AI's speech. If it's a real audio URI, it will attempt to play.
  // If it's the "tts-simulation:..." string, it will not play.
  const aiSpeechAudioUri = isAI && turn.audioDataUri ? turn.audioDataUri : undefined;

  // This is for User's speech, if user audio playback was to be implemented.
  const userSpeechAudioUri = !isAI && turn.audioDataUri && turn.audioDataUri.startsWith("data:audio") ? turn.audioDataUri : undefined;


  const handlePlayAISpeech = () => {
    if (audioRef.current && isPlayableAudioDataUri) {
      audioRef.current.play().catch(e => {
        console.error("Error playing AI speech:", e);
        toast({variant: "destructive", title:"Audio Playback Error", description: "Could not play AI speech."});
      });
    } else if (aiSpeechAudioUri && !isPlayableAudioDataUri) {
        // If it's the descriptive URI, we don't try to play it.
        // UI will just show the text.
    }
  };
  
  const handlePlayUserSpeech = () => {
    if (userSpeechAudioUri && onPlayAudio) {
        onPlayAudio(userSpeechAudioUri); // This would call a parent handler to play user's recorded audio
    }
  }

  useEffect(() => {
    // Autoplay AI speech if it's a new AI turn with playable audio
    // This might be too aggressive; consider a manual play button if preferred
    if (isAI && isPlayableAudioDataUri && audioRef.current) {
      // handlePlayAISpeech(); 
      // Autoplay disabled for now, user can click. If enabled, add a way to mute/control.
    }
  }, [turn.id, isAI, isPlayableAudioDataUri]);


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
          
          {isAI && aiSpeechAudioUri && isPlayableAudioDataUri && (
            <>
              <audio ref={audioRef} src={aiSpeechAudioUri} className="hidden" />
              <Button
                variant={"ghost"}
                size="xs"
                onClick={handlePlayAISpeech}
                className={cn("mt-1 h-7 text-xs flex items-center", 
                  isAI ? "text-primary hover:bg-primary/10" : "text-primary-foreground/80 hover:bg-primary-foreground/20"
                )}
              >
                <PlayCircle className="mr-1.5 h-4 w-4" /> Play AI Response
              </Button>
            </>
          )}
          
          {isAI && aiSpeechAudioUri && !isPlayableAudioDataUri && (
             <p className={cn("text-xs italic mt-1 flex items-center", isAI ? "text-muted-foreground/80" : "text-primary-foreground/80")}>
                <AlertCircle size={12} className="mr-1.5 text-amber-600"/> 
                {aiSpeechAudioUri.length > 100 ? aiSpeechAudioUri.substring(0,100) + "..." : aiSpeechAudioUri }
                (Text representation of AI speech)
             </p>
          )}

          {userSpeechAudioUri && onPlayAudio && (
            <Button
              variant={isAI ? "outline" : "secondary"}
              size="xs"
              onClick={handlePlayUserSpeech}
              className={cn("mt-1 h-7 text-xs", isAI ? "border-primary/30 text-primary hover:bg-primary/10" : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" )}
            >
              <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Play User Audio
            </Button>
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
