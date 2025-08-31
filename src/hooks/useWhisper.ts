
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
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
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  // Use refs for callbacks to ensure the latest version is always used inside event listeners
  const onTranscribeRef = useRef(onTranscribe);
  onTranscribeRef.current = onTranscribe;

  const onTranscriptionCompleteRef = useRef(onTranscriptionComplete);
  onTranscriptionCompleteRef.current = onTranscriptionComplete;
  
  const onRecognitionErrorRef = useRef(onRecognitionError);
  onRecognitionErrorRef.current = onRecognitionError;

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    // Initialize the recognition instance only once and store it in a ref.
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        // Process any lingering final transcript when recognition stops unexpectedly
        if (finalTranscriptRef.current.trim()) {
            onTranscriptionCompleteRef.current(finalTranscriptRef.current.trim());
            finalTranscriptRef.current = '';
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (onRecognitionErrorRef.current) onRecognitionErrorRef.current(event);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.error('Speech Recognition Error:', event.error, event.message);
            toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
        }
        setIsRecording(false);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
  
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += event.results[i][0].transcript.trim() + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        onTranscribeRef.current((finalTranscriptRef.current + interimTranscript).trim());
        
        silenceTimeoutRef.current = setTimeout(() => {
            if (finalTranscriptRef.current.trim()) {
              onTranscriptionCompleteRef.current(finalTranscriptRef.current.trim());
              finalTranscriptRef.current = '';
            }
        }, 1000); // 1-second pause indicates end of utterance
      };
    }

    // Cleanup function
    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup if not started
        }
      }
    };
  }, [toast]); // Dependencies are minimal as we use refs for callbacks

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        finalTranscriptRef.current = '';
        if (onTranscribeRef.current) onTranscribeRef.current('');
        recognitionRef.current.start();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
          console.warn("useWhisper: startRecording called when already started.");
        } else {
          console.error("useWhisper: Could not start speech recognition:", e);
        }
      }
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: stopRecording called in an invalid state.", e);
      }
    }
  }, [isRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
