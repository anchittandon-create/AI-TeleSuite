
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text:string) => void;
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
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        finalTranscriptRef.current = '';
        if (onTranscribe) onTranscribe(''); // Clear interim text
        recognitionRef.current.start();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
          // Already started, this is fine
        } else {
          console.error("useWhisper: Could not start speech recognition:", e);
        }
      }
    }
  }, [isRecording, onTranscribe]);

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
    }

    const recognition = recognitionRef.current;

    const handleStart = () => {
      setIsRecording(true);
    };

    const handleEnd = () => {
      setIsRecording(false);
      const finalTranscript = finalTranscriptRef.current.trim();
      if (finalTranscript && onTranscriptionComplete) {
        onTranscriptionComplete(finalTranscript);
      }
      finalTranscriptRef.current = '';
    };

    const handleResult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let currentFinalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0].transcript;
        if (result.isFinal) {
          currentFinalTranscript += transcriptChunk + ' ';
        } else {
          interimTranscript += transcriptChunk;
        }
      }

      if(currentFinalTranscript) {
        finalTranscriptRef.current = currentFinalTranscript;
      }
      
      if (onTranscribe) {
        onTranscribe((finalTranscriptRef.current + interimTranscript).trim());
      }
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (onRecognitionError) {
          onRecognitionError(event);
        }
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
            return;
        }
        console.error('Speech recognition error:', event.error, event.message);
        toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
        setIsRecording(false);
    };

    recognition.addEventListener('start', handleStart);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.removeEventListener('start', handleStart);
        recognitionRef.current.removeEventListener('end', handleEnd);
        recognitionRef.current.removeEventListener('result', handleResult);
        recognitionRef.current.removeEventListener('error', handleError);
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore if already stopped or in a bad state
        }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError, toast]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
