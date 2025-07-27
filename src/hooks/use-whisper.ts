
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

// Define the shape of the transcript object
interface Transcript {
  text: string;
  isFinal: boolean;
}

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text: string) => void;
  autoStart?: boolean;
  autoStop?: boolean;
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
  autoStart = false,
  autoStop = false,
  stopTimeout = 600, // Reduced from 1200ms to 600ms for faster response
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<Transcript>({ text: '', isFinal: false });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Can happen if it's already stopped.
      }
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    
    try {
        // A check to prevent starting if it's somehow already in a speaking or starting state.
        // This is a safeguard against the "recognition has already started" error.
        if ((recognitionRef.current as any)._started) {
            console.warn("useWhisper: Recognition is already listening. Ignoring start command.");
            return;
        }
        setIsRecording(true);
        (recognitionRef.current as any)._started = true; // custom flag
        recognitionRef.current.start();
    } catch(e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
            console.warn("useWhisper: Tried to start recognition that was already started. Ignoring.");
        } else {
            console.error("useWhisper: Could not start speech recognition:", e);
            setIsRecording(false);
            (recognitionRef.current as any)._started = false;
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
      (recognitionRef.current as any)._started = false;
    }
    
    const recognition = recognitionRef.current;

    const handleResult = (event: SpeechRecognitionEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      const currentText = finalTranscript || interimTranscript;
      const isFinal = !!finalTranscript;
      
      setTranscript({ text: currentText, isFinal });

      if (onTranscribe && currentText) {
          onTranscribe(currentText);
      }

      if (autoStop) {
        timeoutRef.current = setTimeout(() => {
          stopRecording();
        }, stopTimeout);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      (recognitionRef.current as any)._started = false;
      if (transcript.text && onTranscriptionComplete) {
        onTranscriptionComplete(transcript.text);
      }
      setTranscript({ text: '', isFinal: false });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
          // These are normal events, not errors that need to be logged to the console.
          // They simply indicate the user was silent, the recognition was stopped, or mic permission was denied.
        } else {
            console.error('Speech recognition error:', event.error, event.message);
        }
        setIsRecording(false);
        (recognitionRef.current as any)._started = false;
    }

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('error', handleError);

    return () => {
      recognition.removeEventListener('result', handleResult);
      recognition.removeEventListener('end', handleEnd);
      recognition.removeEventListener('error', handleError);
      if (recognitionRef.current) {
        try {
            recognitionRef.current.stop();
        } catch(e) { /* Ignore */ }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, autoStop, stopTimeout, stopRecording, transcript.text]);
  
   useEffect(() => {
    if (autoStart) {
      startRecording();
    }
   }, [autoStart, startRecording]);
  
  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    whisperInstance: recognitionRef.current,
  };
}
