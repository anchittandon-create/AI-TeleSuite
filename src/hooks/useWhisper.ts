
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
}

// Correctly get the browser's SpeechRecognition object
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
  
  // Use useRef to hold the recognition instance. This is the key to stability.
  // It ensures the instance is not re-created on every render.
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Use useRef to hold the final transcript to avoid stale state in callbacks.
  const finalTranscriptRef = useRef<string>('');
  
  // Use a ref for the timeout to ensure we can clear it reliably.
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API is not supported in this browser.');
      return;
    }

    // Initialize the recognition instance only once.
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      recognitionRef.current = recognition;
    }

    const recognition = recognitionRef.current;

    const handleResult = (event: SpeechRecognitionEvent) => {
      // Clear any existing silence timer because the user is actively speaking.
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript.trim() + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // Update the real-time transcription display.
      onTranscribe((finalTranscriptRef.current + interimTranscript).trim());
      
      // Set a new silence timer. If the user pauses for 1 second, we assume they are done.
      silenceTimeoutRef.current = setTimeout(() => {
          if (finalTranscriptRef.current.trim()) {
            onTranscriptionComplete(finalTranscriptRef.current.trim());
            finalTranscriptRef.current = ''; // Reset for the next turn.
          }
      }, 1000); // 1-second pause indicates the end of an utterance.
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech Recognition Error:', event.error);
      if (onRecognitionError) onRecognitionError(event);

      // Avoid showing toasts for common, non-critical errors.
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return; 
      }
      toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
      setIsRecording(false);
    };

    const handleEnd = () => {
      setIsRecording(false);
      // Ensure any lingering transcript is processed when recognition ends.
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (finalTranscriptRef.current.trim()) {
        onTranscriptionComplete(finalTranscriptRef.current.trim());
        finalTranscriptRef.current = '';
      }
    };

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;
    recognition.onstart = () => setIsRecording(true);

    // Cleanup function to remove listeners and stop recognition if the component unmounts.
    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors on cleanup.
        }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError, toast]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        finalTranscriptRef.current = '';
        if (onTranscribe) onTranscribe('');
        recognitionRef.current.start();
      } catch (e) {
        // This can happen if the state is not perfectly in sync. It's a safe-guard.
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
          console.warn("useWhisper: startRecording called when already started.");
        } else {
          console.error("useWhisper: Could not start speech recognition:", e);
        }
      }
    }
  }, [isRecording, onTranscribe]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        // Stop will trigger the 'onend' event, which handles state updates and cleanup.
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
