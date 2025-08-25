
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
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
  stopTimeout = 1000, 
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      // Use a try-catch as stop() can throw if already stopped.
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // console.warn("useWhisper: stop() called on already stopped recognition.");
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (isRecording || !recognitionRef.current) {
      return;
    }
    
    try {
        finalTranscriptRef.current = "";
        recognitionRef.current.start();
        setIsRecording(true);
    } catch(e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
            // This can happen if the API is in a weird state.
            // We'll try to reset by stopping and letting the end handler clean up.
            console.warn("useWhisper: Tried to start recognition that was already started. Attempting to recover.");
            try {
              recognitionRef.current.stop();
            } catch (stopErr) {
              // Ignore if stopping also fails
            }
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

    const handleResult = (event: SpeechRecognitionEvent) => {
      // As soon as we get any result, clear any pending stop timeout.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript.trim() + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // If there's interim transcript, it means the user is actively speaking.
      if (interimTranscript.trim()) {
          // Forcefully cancel any AI audio playback immediately.
          cancelAudio();
          // Update the UI with the real-time transcript.
          onTranscribe(interimTranscript);
      }
      
      // Reset the stop timeout. If the user pauses for `stopTimeout` ms, this will fire.
      timeoutRef.current = setTimeout(() => {
          stopRecording();
      }, stopTimeout);
    };
    
    const handleEnd = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      
      // Only call the completion handler if we have a final transcript.
      if (finalTranscriptRef.current.trim()) {
        onTranscriptionComplete(finalTranscriptRef.current.trim());
      }
      
      // Reset for the next turn.
      finalTranscriptRef.current = "";
      if (isRecording) {
        setIsRecording(false);
      }
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        // 'aborted' can happen if we call stop() manually. 'no-speech' is also a common case.
        if (event.error === 'aborted' || event.error === 'no-speech') {
            handleEnd(); // Treat no-speech like a natural end to trigger processing of any final transcript
            return; 
        }

        if (event.error === 'network') {
           toast({
            variant: "destructive",
            title: "Speech Recognition Network Issue",
            description: "Could not connect to the speech recognition service. Please check your network.",
          });
        } else {
            console.error('Speech recognition error:', event.error, event.message);
        }
        setIsRecording(false); // Ensure we are in a non-recording state after an error.
    }

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('error', handleError);

    // Cleanup function.
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
  }, [onTranscribe, onTranscriptionComplete, stopTimeout, stopRecording, toast, cancelAudio, isRecording]);
  
  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
