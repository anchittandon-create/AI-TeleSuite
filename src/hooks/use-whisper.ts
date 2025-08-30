
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text:string) => void;
  stopTimeout?: number;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
  cancelAudio: () => void;
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
  stopTimeout = 0.01, // Default to 10ms for instant response after user stops talking
  onRecognitionError,
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: Stop listening called on an already stopped instance.");
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    try {
      finalTranscriptRef.current = '';
      recognitionRef.current.start();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        console.warn("useWhisper: Tried to start recognition that was already listening. Ignoring.");
      } else {
        console.error("useWhisper: Could not start speech recognition:", e);
        setIsRecording(false);
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
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-IN';
    }

    const recognition = recognitionRef.current;

    const handleStart = () => setIsRecording(true);
    const handleEnd = () => {
      setIsRecording(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    
    const handleResult = (event: SpeechRecognitionEvent) => {
      cancelAudio(); // THE CRITICAL FIX: Interrupt AI audio as soon as user speaks.
      if(timeoutRef.current) clearTimeout(timeoutRef.current);

      let interimTranscript = '';
      let finalChunk = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0].transcript;
        
        if (result.isFinal) {
          finalChunk += transcriptChunk;
        } else {
          interimTranscript += transcriptChunk;
        }
      }
      
      if (finalChunk) {
         finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + finalChunk;
      }
      
      const currentFullTranscript = (finalTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript : '')).trim();
      if (onTranscribe) {
        onTranscribe(currentFullTranscript);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (onTranscriptionComplete) {
            onTranscriptionComplete(currentFullTranscript);
            finalTranscriptRef.current = ''; // Reset for next turn
        }
        stopListening();
      }, stopTimeout * 1000);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      if (onRecognitionError) {
          onRecognitionError(event);
      }
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
        // These are common and often not indicative of a real problem, especially 'aborted' on interruption.
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
      if(timeoutRef.current) clearTimeout(timeoutRef.current);
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
  }, [onTranscribe, onTranscriptionComplete, toast, stopListening, stopTimeout, onRecognitionError, cancelAudio]);

  return {
    isRecording,
    startRecording: startListening,
    stopRecording: stopListening,
  };
}
