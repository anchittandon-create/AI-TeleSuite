
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface Transcript {
  text: string;
}

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text:string) => void;
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
  stopTimeout = 100, // Default to a very responsive 100ms
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && (recognitionRef.current as any)._started) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
         console.warn("useWhisper: Stop recording called on an already stopped instance.");
      }
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording) {
      return;
    }
    
    // Clear any previous final transcript
    finalTranscriptRef.current = "";

    try {
        if (!recognitionRef.current) throw new Error("Speech Recognition not initialized.");
        if ((recognitionRef.current as any)._started) {
            console.warn("useWhisper: Recognition is already listening. Ignoring start command.");
            return;
        }
        (recognitionRef.current as any)._started = true;
        recognitionRef.current.start();
        setIsRecording(true);
    } catch(e) {
        console.error("useWhisper: Could not start speech recognition:", e);
        setIsRecording(false);
        if (recognitionRef.current) {
            (recognitionRef.current as any)._started = false;
        }
    }
    
  }, [isRecording]);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Browser Not Supported', description: 'Speech Recognition is not available in this browser.'})
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
      // Immediately stop any AI playback on user speech
      cancelAudio();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      onTranscribe(interimTranscript);

      // Set timeout to finalize transcription after user stops speaking
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, stopTimeout);
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      if (recognitionRef.current) {
          (recognitionRef.current as any)._started = false;
      }
      
      const finalTranscript = finalTranscriptRef.current.trim();
      if (finalTranscript && onTranscriptionComplete) {
        onTranscriptionComplete(finalTranscript);
      }
      finalTranscriptRef.current = "";

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
          // Normal events, do not show toast
        } else if (event.error === 'network') {
           toast({
            variant: "destructive",
            title: "Speech Recognition Network Issue",
            description: "Please check your network and try again.",
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
            recognitionRef.current.abort(); // Use abort for forceful stop
        } catch(e) { /* Ignore */ }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, stopTimeout, stopRecording, toast, cancelAudio]);
  
  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
