
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
  const finalTranscriptRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop(); // This will trigger the 'end' event
      } catch (e) {
        console.warn("useWhisper: stopRecording called when not in a valid state.", e);
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        finalTranscriptRef.current = '';
        if (onTranscribe) onTranscribe('');
        recognitionRef.current.start();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
          // Already started, which is fine in some race conditions
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

    const handleStart = () => setIsRecording(true);
    const handleEnd = () => setIsRecording(false);

    const handleResult = (event: SpeechRecognitionEvent) => {
      // Clear any existing silence detection timer, as speech is actively being received.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Append final parts to the ref holding the complete utterance.
          finalTranscriptRef.current += transcriptPart + ' ';
        } else {
          // Accumulate the current interim (in-progress) part.
          interimTranscript += transcriptPart;
        }
      }
      
      // Update the UI with the combination of final and interim parts for a real-time effect.
      onTranscribe((finalTranscriptRef.current + interimTranscript).trim());
      
      // **This is the critical fix:**
      // Only set the silence detection timeout if we have a final transcript part.
      // This means the user has completed a phrase. We then wait to see if they continue.
      if (finalTranscriptRef.current.trim()) {
        timeoutRef.current = setTimeout(() => {
            // If the timeout executes, it means the user has paused.
            // We now consider the utterance complete.
            const fullTranscript = finalTranscriptRef.current.trim();
            if (fullTranscript) {
              onTranscriptionComplete(fullTranscript);
              // Reset the final transcript ref for the next utterance.
              finalTranscriptRef.current = '';
            }
        }, 600); // Use the faster 600ms timeout.
      }
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      if (onRecognitionError) onRecognitionError(event);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return; // Ignore these common non-errors
      }
      toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
      setIsRecording(false);
    };

    recognition.addEventListener('start', handleStart);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError, toast]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
