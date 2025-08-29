
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text: string) => void;
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
  stopTimeout = 1, // Defaulting to the fastest possible timeout
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: Stop recording called on an already stopped instance.");
      }
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
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
        setIsRecording(false); // Reset state on error
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

    const handleStart = () => {
      setIsRecording(true);
    };

    const handleEnd = () => {
      setIsRecording(false);
      const finalText = finalTranscriptRef.current.trim();
      if (onTranscriptionComplete && finalText) {
        onTranscriptionComplete(finalText);
      }
      finalTranscriptRef.current = '';
    };

    const handleResult = (event: SpeechRecognitionEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      const currentTextForDisplay = (finalTranscriptRef.current + interimTranscript).trim();
      
      if (onTranscribe) {
        onTranscribe(currentTextForDisplay);
      }

      // This is the core logic for immediate silence detection.
      // On any result, we start a very short timer. If no new result comes in
      // within that time, we assume the user has paused and we stop recording.
      timeoutRef.current = setTimeout(() => {
        if (isRecording) { // Check if we are still supposed to be recording
          stopRecording();
        }
      }, stopTimeout);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
        // These are normal, non-critical events.
      } else if (event.error === 'network') {
        toast({
          variant: "destructive",
          title: "Speech Recognition Network Issue",
          description: "Could not connect to the speech recognition service. Please check your network and try again.",
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
      recognition.removeEventListener('start', handleStart);
      recognition.removeEventListener('end', handleEnd);
      recognition.removeEventListener('result', handleResult);
      recognition.removeEventListener('error', handleError);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, stopTimeout, toast, isRecording, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
