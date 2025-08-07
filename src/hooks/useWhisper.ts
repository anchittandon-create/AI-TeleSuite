
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
  onTranscriptionComplete?: (text: string) => void;
  autoStart?: boolean;
  stopTimeout?: number; // Make timeout configurable
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
  stopTimeout = 90, // Default to a more responsive 90ms
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<Transcript>({ text: '', isFinal: false });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const { toast } = useToast();

  const stableOnTranscribe = useCallback(onTranscribe || (() => {}), [onTranscribe]);
  const stableOnTranscriptionComplete = useCallback(onTranscriptionComplete || (() => {}), [onTranscriptionComplete]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Can happen if it's already stopped.
      }
    }
  }, []);

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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      let interimTranscript = '';
      let newlyFinalizedText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newlyFinalizedText += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      const currentFinalText = finalTranscriptRef.current + newlyFinalizedText;
      finalTranscriptRef.current = currentFinalText;
      const currentText = currentFinalText + interimTranscript;
      setTranscript({ text: currentText, isFinal: !!currentFinalText.trim() });

      stableOnTranscribe(currentText);

      // If we got a final result, trigger completion after a short delay
      if (newlyFinalizedText.trim()) {
        timeoutRef.current = setTimeout(() => {
            if (finalTranscriptRef.current.trim()) {
              stableOnTranscriptionComplete(finalTranscriptRef.current.trim());
              finalTranscriptRef.current = ""; // Reset after firing
            }
        }, stopTimeout);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      if (recognitionRef.current) (recognitionRef.current as any)._started = false;
      
      // Safety net: if there's any pending final text when recognition fully stops, send it.
      if (finalTranscriptRef.current.trim()) {
        stableOnTranscriptionComplete(finalTranscriptRef.current.trim());
      }
      finalTranscriptRef.current = "";
      setTranscript({ text: '', isFinal: false });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (!['no-speech', 'aborted', 'audio-capture'].includes(event.error)) {
             toast({ variant: "destructive", title: "Speech Recognition Error", description: `Error: ${event.error}. Please check network and permissions.` });
        }
        setIsRecording(false);
        if (recognitionRef.current) (recognitionRef.current as any)._started = false;
    }

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('error', handleError);

    return () => {
      recognition.removeEventListener('result', handleResult);
      recognition.removeEventListener('end', handleEnd);
      recognition.removeEventListener('error', handleError);
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) { /* Ignore */ }
    };
  }, [stableOnTranscribe, stableOnTranscriptionComplete, stopTimeout, toast]);
  
  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) return;
    finalTranscriptRef.current = "";
    setTranscript({ text: '', isFinal: false });
    
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
             toast({ variant: 'destructive', title: 'Microphone Error', description: `Could not access microphone: ${e instanceof Error ? e.message : 'Unknown error'}`});
            setIsRecording(false);
            if (recognitionRef.current) (recognitionRef.current as any)._started = false;
        }
    }
  }, [isRecording, toast]);
  
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
  };
}
