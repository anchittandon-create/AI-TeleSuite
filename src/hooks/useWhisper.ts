
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
  
  // Use refs for callbacks to ensure the latest version is always used in event handlers
  const onTranscribeRef = useRef(onTranscribe);
  const onTranscriptionCompleteRef = useRef(onTranscriptionComplete);
  const onRecognitionErrorRef = useRef(onRecognitionError);

  useEffect(() => {
    onTranscribeRef.current = onTranscribe;
    onTranscriptionCompleteRef.current = onTranscriptionComplete;
    onRecognitionErrorRef.current = onRecognitionError;
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop(); // This will trigger the 'end' event
      } catch (e) {
        // This can happen if the recognition is already stopping. It's safe to ignore.
        console.warn("useWhisper: stopRecording called when recognition was already stopping.", e);
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        finalTranscriptRef.current = '';
        onTranscribeRef.current(''); // Clear any old transcription text
        recognitionRef.current.start();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
          // This can happen if start is called again before the 'start' event has fired.
          // It's a benign race condition.
        } else {
          console.error("useWhisper: Could not start speech recognition:", e);
        }
      }
    }
  }, [isRecording]);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    // Initialize the recognition object only once.
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      recognitionRef.current = recognition;

      recognition.onstart = () => setIsRecording(true);
      
      recognition.onend = () => {
        // If there's any final transcript left over when recognition ends, process it.
        const finalTranscript = finalTranscriptRef.current.trim();
        if (finalTranscript) {
          onTranscriptionCompleteRef.current(finalTranscript);
        }
        finalTranscriptRef.current = '';
        setIsRecording(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

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

        // Silence detection logic: if a final part of a transcript has been received,
        // wait a moment to see if the user continues speaking.
        if (finalTranscriptForThisResult.trim()) {
          timeoutRef.current = setTimeout(() => {
              const fullTranscript = finalTranscriptRef.current.trim();
              if (fullTranscript) {
                onTranscriptionCompleteRef.current(fullTranscript);
                finalTranscriptRef.current = ''; // Reset for the next full utterance.
              }
          }, 2000); // 2-second pause indicates end of utterance
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (onRecognitionErrorRef.current) onRecognitionErrorRef.current(event);
        // Ignore common, non-fatal errors
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
      };
    }

    // Cleanup function to stop recognition if the component unmounts
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore if it fails
        }
      }
    };
  }, [toast]); // Empty dependency array ensures this effect runs only once.

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
