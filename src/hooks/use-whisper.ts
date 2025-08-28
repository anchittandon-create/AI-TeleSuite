
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text: string) => void;
  autoStart?: boolean;
  autoStop?: boolean;
  stopTimeout?: number;
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
  autoStop = false,
  stopTimeout = 2000, // A more reasonable default, page will override with 2ms
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>(''); // Ref to accumulate final transcript
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Can happen if it's already stopped.
      }
    }
  }, []);

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
    
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening even after a pause
      recognitionRef.current.interimResults = true; // Get results as they come
      recognitionRef.current.lang = 'en-IN';
    }
    
    const recognition = recognitionRef.current;

    const handleResult = (event: SpeechRecognitionEvent) => {
      cancelAudio(); // Interrupt AI audio on any speech detection

      // Always clear the previous timeout on new speech activity
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0].transcript;

        if (result.isFinal) {
          // Append final chunks to our ref
          finalTranscriptRef.current += transcriptChunk + ' ';
        } else {
          interimTranscript += transcriptChunk;
        }
      }
      
      const currentTextForDisplay = finalTranscriptRef.current + interimTranscript;
      
      if (onTranscribe) {
          onTranscribe(currentTextForDisplay);
      }

      // If autoStop is enabled, set a timer to stop the recording.
      // This timer is reset every time a new result comes in.
      if (autoStop) {
        timeoutRef.current = setTimeout(() => {
          stopRecording(); // This will trigger the 'end' event
        }, stopTimeout);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      const finalText = finalTranscriptRef.current.trim();
      if (onTranscriptionComplete && finalText) {
        onTranscriptionComplete(finalText);
      }
      // Reset for next recording
      finalTranscriptRef.current = '';
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
          // These are normal, non-critical events that can happen if user is silent.
        } else if (event.error === 'network') {
           toast({
            variant: "destructive",
            title: "Speech Recognition Network Issue",
            description: "Could not connect to the speech recognition service. Please check your network and try again.",
          });
        } else {
            console.error('Speech recognition error:', event.error, event.message);
        }
        setIsRecording(false); // Ensure we are not stuck in recording state on error
    }

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('error', handleError);

    // Cleanup function
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
