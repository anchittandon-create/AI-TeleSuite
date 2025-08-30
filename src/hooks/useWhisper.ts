
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
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    try {
      finalTranscriptRef.current = '';
      if(onTranscribe) onTranscribe(''); // Clear interim text on start
      recognitionRef.current.start();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        // Already started, this is fine
      } else {
        console.error("useWhisper: Could not start speech recognition:", e);
        setIsRecording(false);
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
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-IN';
    }

    const recognition = recognitionRef.current;

    const handleStart = () => setIsRecording(true);
    const handleEnd = () => {
        setIsRecording(false);
        // Ensure any lingering transcript is processed if recognition ends unexpectedly
        const finalTranscript = finalTranscriptRef.current.trim();
        if (finalTranscript && onTranscriptionComplete) {
            onTranscriptionComplete(finalTranscript);
        }
        finalTranscriptRef.current = '';
    };
    
    const handleResult = (event: SpeechRecognitionEvent) => {
      if(stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscriptRef.current += transcriptChunk + ' ';
        } else {
          interimTranscript += transcriptChunk;
        }
      }
      
      if (onTranscribe) {
        onTranscribe((finalTranscriptRef.current + interimTranscript).trim());
      }
      
      stopTimeoutRef.current = setTimeout(() => {
        if (onTranscriptionComplete) {
            const finalTranscript = finalTranscriptRef.current.trim();
            if(finalTranscript) {
                onTranscriptionComplete(finalTranscript);
            }
            finalTranscriptRef.current = '';
        }
        stopRecording();
      }, 1000); // Increased to 1 second for more reliable silence detection
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      if (onRecognitionError) {
          onRecognitionError(event);
      }
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
        return; 
      } else if (event.error === 'network') {
        toast({
          variant: "destructive",
          title: "Speech Recognition Network Issue",
          description: "Could not connect to the speech recognition service.",
        });
      } else {
        console.error('Speech recognition error:', event.error, event.message);
      }
      setIsRecording(false);
    };

    recognition.addEventListener('start', handleStart);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);

    return () => {
      if(stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.removeEventListener('start', handleStart);
        recognitionRef.current.removeEventListener('end', handleEnd);
        recognitionRef.current.removeEventListener('result', handleResult);
        recognitionRef.current.removeEventListener('error', handleError);
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, toast, onRecognitionError, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
