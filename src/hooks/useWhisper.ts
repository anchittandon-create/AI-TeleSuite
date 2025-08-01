
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
  onTranscriptionComplete?: (text: string, audioUri?: string) => void;
  autoStop?: boolean;
  stopTimeout?: number;
  captureAudio?: boolean; // New prop to enable audio capture
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
  stopTimeout = 700,
  captureAudio = false, // Default to false
}: UseWhisperProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<Transcript>({ text: '', isFinal: false });
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | undefined>(undefined);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const justStoppedRef = useRef<boolean>(false);
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        justStoppedRef.current = true;
        recognitionRef.current.stop();
        setTimeout(() => { justStoppedRef.current = false; }, 100);
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || !recognitionRef.current || justStoppedRef.current) {
      return;
    }
    finalTranscriptRef.current = "";
    setTranscript({ text: '', isFinal: false });
    setRecordedAudioUri(undefined);

    try {
        if (captureAudio) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setRecordedAudioUri(audioUrl);
                     if (onTranscriptionComplete) {
                        onTranscriptionComplete(finalTranscriptRef.current.trim(), audioUrl);
                    }
                } else {
                    // if there's no audio data, but there was a final transcript, call the completion handler without an audio URI
                    if (onTranscriptionComplete && finalTranscriptRef.current.trim()) {
                         onTranscriptionComplete(finalTranscriptRef.current.trim(), undefined);
                    }
                }
                stream.getTracks().forEach(track => track.stop()); // Stop microphone access
            };
            mediaRecorderRef.current.start();
        }

        if ((recognitionRef.current as any)._started) {
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
    
  }, [isRecording, captureAudio, onTranscriptionComplete, toast]);

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
      setTranscript({ text: currentText, isFinal: !!finalTranscriptRef.current });

      if (onTranscribe) onTranscribe(currentText);

      if (autoStop && !!finalTranscriptRef.current) { // Trigger timeout only on final result
        timeoutRef.current = setTimeout(() => {
            stopRecording();
        }, stopTimeout);
      }
    };
    
    const handleEnd = () => {
      setIsRecording(false);
      if (recognitionRef.current) (recognitionRef.current as any)._started = false;
      
      if (!captureAudio && onTranscriptionComplete && finalTranscriptRef.current.trim()) {
        onTranscriptionComplete(finalTranscriptRef.current.trim(), undefined);
      }
      // If capturing audio, onTranscriptionComplete is called in mediaRecorder.onstop

      setTranscript({ text: '', isFinal: false });
      finalTranscriptRef.current = "";
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
  }, [onTranscribe, onTranscriptionComplete, autoStop, stopTimeout, stopRecording, toast, captureAudio]);
  
  return {
    isRecording,
    transcript,
    recordedAudioUri,
    startRecording,
    stopRecording,
    whisperInstance: recognitionRef.current,
  };
}
