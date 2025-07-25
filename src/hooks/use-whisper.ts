
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

interface WhisperHookOptions {
  onTranscribe?: () => void;
  onTranscriptionComplete?: (text: string) => void;
  autoStart?: boolean;
  autoStop?: boolean;
  stopTimeout?: number;
}

interface WhisperTranscript {
  text: string;
}

/**
 * A hook for handling real-time audio recording and transcription simulation.
 * It's designed for low latency and supports interruption.
 */
export function useWhisper(options: WhisperHookOptions) {
  const { 
    onTranscribe, 
    onTranscriptionComplete,
    autoStart = false,
    autoStop = false,
    stopTimeout = 1200 // Default to 1.2 seconds as requested.
  } = options;

  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<WhisperTranscript>({ text: "" });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stop media stream and recorder cleanly.
  const stopMediaStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("MediaRecorder could not be stopped (might have already been stopped):", e);
      }
    }
    mediaRecorderRef.current = null;
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  // Simplified "transcription" - in this app, we just use the browser's speech recognition.
  // This is a placeholder for a real speech-to-text engine like Whisper, but provides the low-latency behavior.
  const processAudioForTranscription = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Speech recognition is not supported by your browser. Please use Google Chrome.' });
      return;
    }
    
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript({ text: finalTranscript || interimTranscript });
       if (onTranscribe) {
        onTranscribe();
      }

      if(finalTranscript && onTranscriptionComplete){
        onTranscriptionComplete(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      let errorMessage = `Speech recognition error: ${event.error}.`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        errorMessage = 'Microphone access was denied. Please enable it in your browser settings.';
      } else if (event.error === 'no-speech') {
        errorMessage = 'No speech was detected. Please try again.';
      }
      toast({ variant: 'destructive', title: 'Recognition Error', description: errorMessage });
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognition.start();
    setIsRecording(true);
    
  }, [toast, onTranscribe, onTranscriptionComplete]);


  const startRecording = useCallback(async () => {
    if (isRecording) return;
    processAudioForTranscription();
  }, [isRecording, processAudioForTranscription]);
  
  const stopRecording = useCallback(() => {
    // This is now handled by the browser's speech recognition 'onend' event.
    // The function is kept for API consistency.
    if(isRecording){
       console.log("Speech recognition will stop automatically upon silence.");
    }
  }, [isRecording]);

  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
    return () => {
      stopMediaStream(); // Cleanup on unmount
    };
  }, [autoStart, startRecording, stopMediaStream]);

  const whisperInstance = { startRecording, stopRecording };

  return {
    isRecording,
    transcript,
    whisperInstance
  };
}
