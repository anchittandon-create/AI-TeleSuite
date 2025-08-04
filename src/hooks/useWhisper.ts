
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
  autoStop = true, // Default to true for auto-stop behavior
  stopTimeout = 800, // Default timeout for silence detection
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<Transcript>({ text: '', isFinal: false });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
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
            if (recognitionRef.current) {
                (recognitionRef.current as any)._started = false;
            }
        }
    }
    
  }, [isRecording, toast]);

  const stableOnTranscribe = useCallback(onTranscribe || (() => {}), []);
  const stableOnTranscriptionComplete = useCallback(onTranscriptionComplete || (() => {}), []);

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
      finalTranscriptRef.current = ""; // Reset final transcript on each result event to rebuild it.
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      const currentText = finalTranscriptRef.current + interimTranscript;
      setTranscript({ text: currentText, isFinal: !!finalTranscriptRef.current.trim() });

      stableOnTranscribe(currentText);

      if (autoStop && !!finalTranscriptRef.current.trim()) { // Trigger timeout only on final result
        timeoutRef.current = setTimeout(() => {
            stopRecording();
        }, stopTimeout);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      if (recognitionRef.current) (recognitionRef.current as any)._started = false;
      
      if (finalTranscriptRef.current.trim()) {
        stableOnTranscriptionComplete(finalTranscriptRef.current.trim());
      }

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
  }, [stableOnTranscribe, stableOnTranscriptionComplete, autoStop, stopTimeout, stopRecording, toast]);
  
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
