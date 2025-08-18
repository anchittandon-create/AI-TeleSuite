"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the shape of the transcript object
interface Transcript {
  text: string;
  isFinal: boolean;
}

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text:string) => void;
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
  stopTimeout = 90, 
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<Transcript>({ text: '', isFinal: false });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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
        if ((recognitionRef.current as any)._started) {
            console.warn("useWhisper: Recognition is already listening. Ignoring start command.");
            return;
        }
        setIsRecording(true);
        (recognitionRef.current as any)._started = true;
        recognitionRef.current.start();
    } catch(e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
            console.warn("useWhisper: Tried to start recognition that was already started. Ignoring.");
        } else {
            console.error("useWhisper: Could not start speech recognition:", e);
            setIsRecording(false);
            if (recognitionRef.current) {
                (recognitionRef.current as any)._started = false;
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

      if (autoStop && isFinal && finalTranscript.trim()) {
        timeoutRef.current = setTimeout(() => {
          stopRecording();
        }, stopTimeout);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      if (recognitionRef.current) {
          (recognitionRef.current as any)._started = false;
      }
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
        if (recognitionRef.current) {
            (recognitionRef.current as any)._started = false;
        }
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
  }, [onTranscribe, onTranscriptionComplete, autoStop, stopTimeout, stopRecording, transcript.text, toast]);
  
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
    whisperInstance: recognitionRef.current, // Expose the instance
  };
}