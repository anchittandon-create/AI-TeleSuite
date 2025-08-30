
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text:string) => void;
  stopTimeout?: number;
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
  stopTimeout = 0.01, // Default to 10ms for instant response
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: Stop listening called on an already stopped instance.");
      }
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    try {
      finalTranscriptRef.current = '';
      recognitionRef.current.start();
      setIsRecording(true);
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

    const handleResult = (event: SpeechRecognitionEvent) => {
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
      
      if (finalChunk.trim()) {
         finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + finalChunk.trim();
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
        stopRecording();
      }, stopTimeout * 1000);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
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

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);
    recognition.addEventListener('end', () => setIsRecording(false)); // Ensure state is synced on any end event

    return () => {
      if(timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        recognition.removeEventListener('result', handleResult);
        recognition.removeEventListener('error', handleError);
        recognition.removeEventListener('end', () => setIsRecording(false));
        try {
          recognition.abort();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, toast, stopRecording, stopTimeout]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
