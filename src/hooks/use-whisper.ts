
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
  stopTimeout = 0.5, // Aggressive 0.5-second timeout, as requested for near-instant response.
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // This can happen if the recognition service stops itself, which is normal.
        // console.warn("useWhisper: Stop recording called on an already stopped instance.");
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    try {
      finalTranscriptRef.current = '';
      recognitionRef.current.start();
    } catch (e) {
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
      
      // Only call complete if there's actual text to process.
      if (onTranscriptionComplete && finalText) {
        onTranscriptionComplete(finalText);
      }
      finalTranscriptRef.current = '';
    };

    const handleResult = (event: SpeechRecognitionEvent) => {
      // If the AI is speaking, user speech should interrupt it.
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
      
      // This is the core silence detection. After any speech result, set a timer.
      // If no new results come in within the `stopTimeout` period, we assume silence.
      timeoutRef.current = setTimeout(() => {
          stopRecording();
      }, stopTimeout * 1000);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are common and don't necessarily represent user-facing errors.
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
        // console.warn(`Speech recognition event: ${event.error}`);
      } else if (event.error === 'network') {
        toast({
          variant: "destructive",
          title: "Speech Recognition Network Issue",
          description: "Could not connect to the speech recognition service. Please check your internet connection.",
        });
      } else {
        console.error('Speech recognition error:', event.error, event.message);
      }
      setIsRecording(false);
    };

    recognition.addEventListener('start', handleStart);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);

    return () => {
      if(timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognition) {
        recognition.removeEventListener('start', handleStart);
        recognition.removeEventListener('end', handleEnd);
        recognition.removeEventListener('result', handleResult);
        recognition.removeEventListener('error', handleError);
        try {
          recognition.stop();
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
