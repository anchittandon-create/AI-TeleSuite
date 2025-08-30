
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// Define the properties for the useWhisper hook
interface UseWhisperProps {
  onTranscribe?: (text: string) => void;
  onTranscriptionComplete?: (text:string) => void;
  stopTimeout?: number; // The timeout in seconds to wait for more speech before stopping
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
  stopTimeout = 0.01, // Default to 10ms for instant response
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // This can happen if stop is called on an already stopped instance, which is fine.
        console.warn("useWhisper: Stop recording called on an already stopped instance.");
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    // Do not start if an instance is already active
    if (isRecording || !recognitionRef.current) {
      return;
    }
    try {
      finalTranscriptRef.current = '';
      recognitionRef.current.start();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        // This is expected if the user tries to start while it's already running. Ignore.
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
      toast({ variant: 'destructive', title: 'Browser Not Supported', description: 'Speech recognition is not supported in your browser.' });
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const finalText = finalTranscriptRef.current.trim();
      if (onTranscriptionComplete && finalText) {
        onTranscriptionComplete(finalText);
      }
      finalTranscriptRef.current = '';
    };

    const handleResult = (event: SpeechRecognitionEvent) => {
      // THIS IS THE CRITICAL CHANGE FOR INTERRUPTIBILITY
      // If we get any result, it means the user is speaking. Immediately stop any AI audio.
      cancelAudio(); 
      
      let interimTranscript = '';
      let finalChunk = '';
      
      if(timeoutRef.current) clearTimeout(timeoutRef.current);

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0].transcript;
        
        if (result.isFinal) {
          finalChunk += transcriptChunk;
        } else {
          interimTranscript += transcriptChunk;
        }
      }
      
      if (finalChunk) {
         finalTranscriptRef.current += finalChunk;
      }
      
      const currentFullTranscript = (finalTranscriptRef.current + interimTranscript).trim();
      if (onTranscribe) {
        onTranscribe(currentFullTranscript);
      }
      
      // Stop the recording if we get a final result OR if the timer runs out.
      timeoutRef.current = setTimeout(() => {
          stopRecording();
      }, stopTimeout * 1000);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      // Ignore common, non-critical errors. 'aborted' can happen during normal interruption.
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
        return;
      } 
      if (event.error === 'network') {
        toast({
          variant: "destructive",
          title: "Speech Recognition Network Issue",
          description: "Could not connect to the speech recognition service.",
        });
      } else {
        console.error('Speech recognition error:', event.error, event.message);
      }
      setIsRecording(false); // Ensure we reset state on other errors
    };

    recognition.addEventListener('start', handleStart);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);

    return () => {
      if(timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.removeEventListener('start', handleStart);
        recognitionRef.current.removeEventListener('end', handleEnd);
        recognitionRef.current.removeEventListener('result', handleResult);
        recognitionRef.current.removeEventListener('error', handleError);
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, toast, stopRecording, cancelAudio, stopTimeout]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
