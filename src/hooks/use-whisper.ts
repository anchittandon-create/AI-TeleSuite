
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { useToast } from './use-toast';

interface WhisperHookOptions {
  onTranscribe?: () => string | void;
  onTranscriptionComplete?: (text: string) => void;
  autoStart?: boolean;
  autoStop?: boolean;
  stopTimeout?: number;
}

interface WhisperTranscript {
  text: string;
  isFinal: boolean;
}

export function useWhisper(options: WhisperHookOptions) {
  const { 
    onTranscribe, 
    onTranscriptionComplete,
    autoStart = false,
    autoStop = false,
    stopTimeout = 1200 
  } = options;

  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isWhisperLoading, setIsWhisperLoading] = useState(false);
  const [transcript, setTranscript] = useState<WhisperTranscript>({ text: "", isFinal: false });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopMediaStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("MediaRecorder could not be stopped:", e);
      }
    }
    mediaRecorderRef.current = null;
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    setIsWhisperLoading(true);
    setTranscript({text: "Transcribing...", isFinal: false});
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const result = await transcribeAudio({ audioDataUri: base64Audio });
        
        let newTranscript = result.diarizedTranscript;
        if(result.accuracyAssessment === "Error" || result.diarizedTranscript.toLowerCase().includes("[error")) {
            newTranscript = `[Audio Input Unclear - Please Repeat]`;
        } else {
             // Extract just the user's speech, removing our structured labels
             newTranscript = result.diarizedTranscript.replace(/\[.*?\]\s*(AGENT:|USER:|SPEAKER \d+:|RINGING:)\s*/gi, "").trim();
        }
        
        setTranscript({ text: newTranscript, isFinal: true });
        if (onTranscriptionComplete) {
          onTranscriptionComplete(newTranscript);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error: any) {
      console.error("Transcription error in useWhisper:", error);
      toast({ variant: 'destructive', title: 'Transcription Error', description: error.message });
      setTranscript({text: `[Error: ${error.message}]`, isFinal: true});
    } finally {
      setIsWhisperLoading(false);
    }
  }, [onTranscriptionComplete, toast]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (audioBlob.size > 200) { 
            processAudio(audioBlob);
        } else {
            console.warn("Empty or very small audio blob, not processing.");
        }
        stopMediaStream();
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [processAudio, stopMediaStream]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          if(onTranscribe) {
             onTranscribe();
          }
          setTranscript({ text: "...", isFinal: false });

          if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
          if (autoStop) {
            stopTimeoutRef.current = setTimeout(stopRecording, stopTimeout);
          }
        }
      };
      
      recorder.onstart = () => {
         audioChunksRef.current = [];
         if (onTranscribe) {
           onTranscribe(); 
         }
         setTranscript({ text: "", isFinal: false });
      }

      recorder.start(250); 
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error starting recording in useWhisper:", err);
      toast({ variant: 'destructive', title: 'Microphone Error', description: err.message });
      setIsRecording(false);
    }
  }, [isRecording, autoStop, stopTimeout, stopRecording, toast, onTranscribe]);

  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
    return () => {
      if (isRecording) {
        stopMediaStream();
      }
    };
  }, [autoStart, startRecording, stopMediaStream, isRecording]);

  const whisperInstance = { startRecording, stopRecording };

  return {
    isRecording,
    isWhisperLoading,
    transcript,
    whisperInstance
  };
}
