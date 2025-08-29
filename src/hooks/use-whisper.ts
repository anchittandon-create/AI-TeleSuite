
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text: string) => void;
  stopTimeout?: number; // Timeout in milliseconds after speech ends
  cancelAudio: () => void;
  autoStop?: boolean;
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
  stopTimeout = 2000,
  cancelAudio,
  autoStop = true,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>(''); // Ref to accumulate final transcript parts
  const { toast } = useToast();

  // Stops the recognition service
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

  // Starts the recognition service
  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    try {
        finalTranscriptRef.current = ''; // Reset transcript on start
        setIsRecording(true);
        recognitionRef.current.start();
    } catch(e) {
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
    
    // Initialize recognition only once
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening even after pauses
      recognitionRef.current.interimResults = true; // Get results as they are being processed
      recognitionRef.current.lang = 'en-IN';
    }
    
    const recognition = recognitionRef.current;

    // This event fires continuously as the user speaks
    const handleResult = (event: SpeechRecognitionEvent) => {
      cancelAudio(); // Interrupt AI audio on any speech detection

      // Reset the silence timer every time a new result comes in
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + ' '; // Append final parts
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      const currentTextForDisplay = (finalTranscriptRef.current + interimTranscript).trim();
      
      if (onTranscribe) {
          onTranscribe(currentTextForDisplay);
      }

      // If auto-stopping is enabled, set a new timeout to stop recognition
      if (autoStop) {
        timeoutRef.current = setTimeout(() => {
          stopRecording();
        }, stopTimeout);
      }
    };
    
    // This event fires when recognition stops (either manually or by timeout)
    const handleEnd = () => {
      setIsRecording(false);
      const finalText = finalTranscriptRef.current.trim();
      if (onTranscriptionComplete && finalText) {
        onTranscriptionComplete(finalText);
      }
      finalTranscriptRef.current = ''; // Clear for the next session
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
  }, [onTranscribe, onTranscriptionComplete, autoStop, stopTimeout, stopRecording, toast, cancelAudio]);
  
  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
