
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

type RecognitionState = 'idle' | 'recording' | 'stopping';

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
  silenceTimeout = 500, 
  inactivityTimeout = 3000,
}: UseWhisperProps) {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
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
    if (recognitionRef.current && recognitionState === 'recording') {
      setRecognitionState('stopping');
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: Exception during stop command.", e);
        setRecognitionState('idle'); 
      }
    }
  }, [recognitionState]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && recognitionState === 'idle') {
      try {
        finalTranscriptRef.current = '';
        onTranscribeRef.current(''); 
        recognitionRef.current.start();
        setRecognitionState('recording');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
           console.warn("useWhisper: Recognition already started.");
        } else {
           console.error("useWhisper: Could not start speech recognition:", e);
           setRecognitionState('idle');
        }
      }
    }
  }, [recognitionState]);
  
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      if (recognitionState === 'recording' && finalTranscriptRef.current === '') {
        onTranscriptionCompleteRef.current(""); 
      }
    }, inactivityTimeout);
  }, [inactivityTimeout, recognitionState]);


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
        setRecognitionState('recording');
        resetInactivityTimer();
      };
      
      recognition.onend = () => {
        setRecognitionState('idle');
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        
        // Ensure any final transcript is processed if `stop` was called manually
        const fullTranscript = finalTranscriptRef.current.trim();
        if (fullTranscript) {
           onTranscriptionCompleteRef.current(fullTranscript);
           finalTranscriptRef.current = '';
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        resetInactivityTimer(); 

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
        onRecognitionErrorRef.current?.(event);
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
          console.warn(`Speech recognition event: ${event.error}`);
        } else {
          toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
        }
        setRecognitionState('idle');
      };
    }

    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      if (recognitionRef.current) {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          try {
            recognitionRef.current.abort();
          } catch(e) { /* ignore */ }
      }
    };
  }, [toast, silenceTimeout, resetInactivityTimer]);

  return {
    isRecording: recognitionState === 'recording',
    startRecording,
    stopRecording,
  };
}
