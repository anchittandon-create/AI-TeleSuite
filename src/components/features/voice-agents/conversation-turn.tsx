
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, User, Bot, AlertCircle } from "lucide-react";
import type { ConversationTurn as ConversationTurnType } from '@/types';
import { cn } from '@/lib/utils';

interface ConversationTurnProps {
  turn: ConversationTurnType;
  onPlayAudio?: (audioDataUri: string) => void;
}

export function ConversationTurn({ turn, onPlayAudio }: ConversationTurnProps) {
  const isAI = turn.speaker === 'AI';

  return (
    <div className={cn("flex items-end gap-2 my-3", isAI ? "justify-start" : "justify-end")}>
      {isAI && (
        <Avatar className="h-8 w-8">
          {/* Placeholder for AI avatar image if you have one */}
          {/* <AvatarImage src="/ai-avatar.png" alt="AI Agent" /> */}
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
          {turn.audioDataUri && onPlayAudio && turn.audioDataUri.startsWith("data:audio") && ( // Check if it's actual audio
            <Button
              variant={isAI ? "outline" : "secondary"}
              size="xs"
              onClick={() => onPlayAudio(turn.audioDataUri!)}
              className={cn("mt-1 h-7 text-xs", isAI ? "border-primary/30 text-primary hover:bg-primary/10" : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" )}
            >
              <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Play Audio
            </Button>
          )}
           {turn.audioDataUri && !turn.audioDataUri.startsWith("data:audio") && ( // Display if it's a placeholder message
             <p className="text-xs italic mt-1 opacity-80 flex items-center">
                <AlertCircle size={12} className="mr-1"/> {turn.audioDataUri}
             </p>
           )}
           {turn.speaker === 'User' && turn.transcriptionAccuracy && (
             <p className="text-xs italic mt-1 opacity-70">
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
          {/* Placeholder for User avatar image if you have one */}
          {/* <AvatarImage src="/user-avatar.png" alt="User" /> */}
          <AvatarFallback className="bg-accent text-accent-foreground">
            <User size={18}/>
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
