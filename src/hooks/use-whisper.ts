
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
  silenceTimeout?: number; // For turn-taking
  inactivityTimeout?: number; // For reminders
}

type RecognitionState = 'idle' | 'recording' | 'stopping';

const getSpeechRecognition = (): typeof window.SpeechRecognition | null => {
  if (typeof window !== 'undefined') {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  return null;
};

// This is a re-architected and stabilized version of the useWhisper hook.
// Key changes:
// 1.  SpeechRecognition instance is created once and stored in a ref to prevent instability.
// 2.  State management is hardened to prevent race conditions.
// 3.  Event listeners are now correctly managed within a dedicated useEffect.
// 4.  Silence detection (for turn-taking) and Inactivity detection (for reminders) are now two distinct, independent timers.
export function useWhisper({
  onTranscribe,
  onTranscriptionComplete,
  onRecognitionError,
  silenceTimeout = 1500, // For turn-taking after speech ends.
  inactivityTimeout = 3000, // For reminders when no speech starts.
}: UseWhisperProps) {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const finalTranscriptRef = useRef<string>('');
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Create and configure the recognition instance only once.
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognitionRef.current = recognition;

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.onstart = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            try {
                recognitionRef.current.abort();
            } catch(e) {}
        }
    }
  }, []);


  const onTranscribeRef = useRef(onTranscribe);
  const onTranscriptionCompleteRef = useRef(onTranscriptionComplete);
  const onRecognitionErrorRef = useRef(onRecognitionError);

  useEffect(() => {
    onTranscribeRef.current = onTranscribe;
    onTranscriptionCompleteRef.current = onTranscriptionComplete;
    onRecognitionErrorRef.current = onRecognitionError;
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      // This is the INACTIVITY reminder. It fires only if no speech is ever detected.
      if (recognitionRef.current && recognitionState === 'recording' && finalTranscriptRef.current === '') {
        onTranscriptionCompleteRef.current(""); // Pass empty string to signal inactivity
      }
    }, inactivityTimeout);
  }, [inactivityTimeout, recognitionState]);


  // Setup event listeners for the recognition instance
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    const handleStart = () => {
      setRecognitionState('recording');
      resetInactivityTimer();
    };

    const handleEnd = () => {
        setRecognitionState('idle');
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        
        // This ensures that if stopRecording() was called manually while the user was speaking,
        // any captured final transcript is still processed.
        const fullTranscript = finalTranscriptRef.current.trim();
        if (fullTranscript) {
           onTranscriptionCompleteRef.current(fullTranscript);
           finalTranscriptRef.current = '';
        }
    };
    
    const handleResult = (event: SpeechRecognitionEvent) => {
        // Any speech result (interim or final) means the user is not inactive.
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        // Clear the end-of-speech silence timer as well.
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

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

        // This is the SILENCE detection for turn-taking. It detects the pause AFTER speech.
        silenceTimeoutRef.current = setTimeout(() => {
            const fullTranscript = finalTranscriptRef.current.trim();
            if (fullTranscript) {
              onTranscriptionCompleteRef.current(fullTranscript);
              finalTranscriptRef.current = '';
            }
        }, silenceTimeout);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
        onRecognitionErrorRef.current?.(event);
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
          console.warn(`Speech recognition event: ${event.error}`);
        } else {
          toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
        }
        setRecognitionState('idle'); // Ensure state is reset on error
    };

    recognition.onstart = handleStart;
    recognition.onend = handleEnd;
    recognition.onresult = handleResult;
    recognition.onerror = handleError;

    // Cleanup listeners when the component unmounts
    return () => {
        if(recognition) {
            recognition.onstart = null;
            recognition.onend = null;
            recognition.onresult = null;
            recognition.onerror = null;
        }
    };

  }, [toast, silenceTimeout, resetInactivityTimer]);


  const startRecording = useCallback(() => {
    if (recognitionRef.current && recognitionState === 'idle') {
      try {
        finalTranscriptRef.current = '';
        onTranscribeRef.current(''); 
        recognitionRef.current.start();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
           console.warn("useWhisper: Recognition already started.");
        } else {
           console.error("useWhisper: Could not start speech recognition:", e);
           setRecognitionState('idle'); // Reset state if start fails
        }
      }
    }
  }, [recognitionState]);


  const stopRecording = useCallback(() => {
    if (recognitionRef.current && recognitionState === 'recording') {
      setRecognitionState('stopping');
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: Exception during stop command.", e);
        setRecognitionState('idle'); 
      }
    }
  }, [recognitionState]);
  
  return {
    isRecording: recognitionState === 'recording',
    startRecording,
    stopRecording,
  };
}
