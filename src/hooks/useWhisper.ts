
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
  silenceTimeout?: number;
}

const getSpeechRecognition = (): typeof window.SpeechRecognition | null => {
  if (typeof window !== 'undefined') {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  return null;
};

export function useWhisper({
  onTranscribe,
  onTranscriptionComplete,
  onRecognitionError,
  silenceTimeout = 3500, // Default to 3.5 seconds
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  const onTranscribeRef = useRef(onTranscribe);
  const onTranscriptionCompleteRef = useRef(onTranscriptionComplete);
  const onRecognitionErrorRef = useRef(onRecognitionError);

  useEffect(() => {
    onTranscribeRef.current = onTranscribe;
    onTranscriptionCompleteRef.current = onTranscriptionComplete;
    onRecognitionErrorRef.current = onRecognitionError;
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: stopRecording called when recognition was already stopping.", e);
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        finalTranscriptRef.current = '';
        onTranscribeRef.current(''); 
        recognitionRef.current.start();
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'InvalidStateError')) {
           console.error("useWhisper: Could not start speech recognition:", e);
        }
      }
    }
  }, [isRecording]);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      recognitionRef.current = recognition;

      recognition.onstart = () => setIsRecording(true);
      
      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        let interimTranscript = '';
        let finalTranscriptForThisResult = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptForThisResult += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        finalTranscriptRef.current += finalTranscriptForThisResult;
        onTranscribeRef.current((finalTranscriptRef.current + interimTranscript).trim());

        timeoutRef.current = setTimeout(() => {
            const fullTranscript = finalTranscriptRef.current.trim();
            // This will call with an empty string for silence, or the final transcript
            onTranscriptionCompleteRef.current(fullTranscript);
            finalTranscriptRef.current = '';
        }, silenceTimeout);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (onRecognitionErrorRef.current) onRecognitionErrorRef.current(event);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // This is a normal occurrence, handle it gracefully by calling onTranscriptionComplete with an empty string
          // which the calling component can interpret as an inactivity timeout.
          onTranscriptionCompleteRef.current("");
          return;
        }
        toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
      };
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch(e) {/* ignore */}
      }
    };
  }, [toast, silenceTimeout]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
