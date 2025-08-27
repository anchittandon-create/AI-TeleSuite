
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete?: (text:string) => void; // This can be made optional if not always needed
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
  cancelAudio,
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState({ text: "", isFinal: false });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
         console.warn("useWhisper: Stop recording called on an already stopped instance.");
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (isRecording) {
      console.warn("useWhisper: startRecording called while already recording. Ignoring.");
      return;
    }

    try {
        if (!recognitionRef.current) throw new Error("Speech Recognition not initialized.");
        setIsRecording(true);
        recognitionRef.current.start();
    } catch(e) {
        console.error("useWhisper: Could not start speech recognition:", e);
        setIsRecording(false);
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
    }
    
    const recognition = recognitionRef.current;

    const handleResult = (event: SpeechRecognitionEvent) => {
      cancelAudio();

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const currentText = finalTranscript.trim() || interimTranscript;
      setTranscript({ text: currentText, isFinal: !!finalTranscript.trim() });
      
      if (onTranscribe) {
        onTranscribe(currentText);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      const finalText = transcript.text.trim();
      if (onTranscriptionComplete && finalText) {
        onTranscriptionComplete(finalText);
      }
      setTranscript({ text: '', isFinal: false });
    };
    
    const handleError = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
          // Normal events
        } else {
            console.error('Speech recognition error:', event.error, event.message);
            toast({
              variant: "destructive",
              title: "Speech Recognition Error",
              description: `Error: ${event.error}. Please check microphone permissions and network.`,
            });
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
            recognitionRef.current.abort();
        } catch(e) { /* Ignore */ }
      }
    };
  }, [onTranscribe, onTranscriptionComplete, toast, cancelAudio, transcript.text]);
  
  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
  };
}

    