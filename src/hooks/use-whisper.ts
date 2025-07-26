
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
 * This version uses the browser's native SpeechRecognition API for simplicity and speed.
 */
export function useWhisper(options: WhisperHookOptions) {
  const { 
    onTranscribe, 
    onTranscriptionComplete,
    autoStart = false,
    autoStop = true,
    stopTimeout = 1200 // Default to 1.2 seconds as requested.
  } = options;

  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<WhisperTranscript>({ text: "" });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        // Do not nullify here immediately, let onend handle it
    }
     if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    // Only set recording to false in onend
  }, []);

  const startRecognition = useCallback(() => {
    if (isRecording || recognitionRef.current) {
      return;
    }
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Speech recognition is not supported by your browser. Please use a modern browser like Google Chrome.' });
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true; // Keep listening even after a pause
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Set language for better accuracy for Indian English

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript({ text: "" }); // Clear previous transcript on start
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Reset the silence timer on any result
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      
      if (onTranscribe) {
        onTranscribe(); // Notify parent component that speech has been detected
      }
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript({ text: finalTranscript || interimTranscript });
      
      // If we have a final transcript segment, call the completion handler
      if (finalTranscript.trim() && onTranscriptionComplete) {
         onTranscriptionComplete(finalTranscript.trim());
         // After a final segment, stop immediately to allow AI to respond
         stopRecognition();
      } else if (autoStop) {
        // If not final, set a timeout to stop if there's a pause
        silenceTimeoutRef.current = setTimeout(() => {
            const currentTranscript = (finalTranscript || interimTranscript).trim();
            if (onTranscriptionComplete && currentTranscript) {
                onTranscriptionComplete(currentTranscript);
            }
            stopRecognition();
        }, stopTimeout);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // The 'no-speech' error is common and not a true bug.
      // It fires when the mic is on but no sound is detected. We can ignore it
      // to avoid showing unnecessary errors to the user.
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // 'audio-capture' can happen if mic is already in use or stops unexpectedly
        // We just stop cleanly.
      } else {
         console.error("Speech Recognition Error:", event.error);
        let errorMessage = `Speech recognition error: ${event.error}.`;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMessage = 'Microphone access was denied. Please enable it in your browser settings.';
        }
        toast({ variant: 'destructive', title: 'Recognition Error', description: errorMessage });
      }
      
      setIsRecording(false);
      recognitionRef.current = null;
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
    
    recognition.start();
    
  }, [isRecording, onTranscribe, onTranscriptionComplete, stopTimeout, toast, stopRecognition, autoStop]);

  useEffect(() => {
    if (autoStart) {
      startRecognition();
    }
  }, [autoStart, startRecognition]);

  // Cleanup effect to stop recognition when the component unmounts
  useEffect(() => {
    return () => {
      if(recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const whisperInstance = { 
    startRecording: startRecognition, 
    stopRecording: stopRecognition 
  };

  return {
    isRecording,
    transcript,
    whisperInstance
  };
}
