
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
  silenceTimeout?: number;
  inactivityTimeout?: number;
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
  silenceTimeout = 500, // Time after user stops talking to finalize transcript
  inactivityTimeout = 3000, // Time of total silence before triggering an empty completion
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
      setIsRecording(false);
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
  
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
        // If there's been absolute silence for the duration, trigger completion with empty string
        if (isRecording && finalTranscriptRef.current === '') {
            onTranscriptionCompleteRef.current(""); 
        }
    }, inactivityTimeout);
  }, [inactivityTimeout, isRecording]);


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

      recognition.onstart = () => {
        setIsRecording(true);
        resetInactivityTimer();
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        resetInactivityTimer(); // Any result means there's activity

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

        silenceTimeoutRef.current = setTimeout(() => {
            const fullTranscript = finalTranscriptRef.current.trim();
            if (fullTranscript) {
              onTranscriptionCompleteRef.current(fullTranscript);
              finalTranscriptRef.current = '';
            }
        }, silenceTimeout);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (onRecognitionErrorRef.current) onRecognitionErrorRef.current(event);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // This can be a normal occurrence, let the inactivity timer handle it.
          return;
        }
        toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
      };
    }

    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch(e) {/* ignore */}
      }
    };
  }, [toast, silenceTimeout, resetInactivityTimer]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
