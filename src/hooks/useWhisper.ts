"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';
import {
  VoiceActivityDetector,
  DEFAULT_VAD_CONFIG,
  type VADConfig,
} from '@/lib/voice-activity-detection';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
  silenceTimeout?: number; // For turn-taking
  inactivityTimeout?: number; // For reminders
  /** VAD configuration for noise filtering. Default: uses DEFAULT_VAD_CONFIG */
  vadConfig?: Partial<VADConfig>;
  /** Enable voice activity detection. Default: true */
  enableVAD?: boolean;
}

export type RecognitionState = 'idle' | 'recording' | 'stopping';

const getSpeechRecognition = (): typeof window.SpeechRecognition | null => {
  if (typeof window !== 'undefined') {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  return null;
};

// This is a re-architected and stabilized version of the useWhisper hook.
// Key changes:
// 1.  SpeechRecognition instance is created once and stored in a ref to prevent instability.
// 2.  State management is hardened to prevent race conditions via state ref.
// 3.  Event listeners are now correctly managed within a dedicated useEffect.
// 4.  Silence detection (for turn-taking) and Inactivity detection (for reminders) are now two distinct, independent timers.
// 5.  ENHANCED: Voice Activity Detection (VAD) to filter background noise
// 6.  ENHANCED: Confidence-based filtering to reject low-quality recognition results
export function useWhisper({
  onTranscribe,
  onTranscriptionComplete,
  onRecognitionError,
  silenceTimeout = 30, // Faster hand-off after speech ends.
  inactivityTimeout = 9000, // Triple the reminder window.
  vadConfig,
  enableVAD = true,
}: UseWhisperProps) {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const finalTranscriptRef = useRef<string>('');
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stateRef = useRef(recognitionState);
  stateRef.current = recognitionState;
  
  // VAD-related refs
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isVoiceActiveRef = useRef<boolean>(false);
  const vadConfigMerged = useMemo(
    () => ({ ...DEFAULT_VAD_CONFIG, ...vadConfig }),
    [vadConfig]
  );
  
  // Create and configure the recognition instance only once.
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognitionRef.current = recognition;

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.onstart = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            try {
                recognitionRef.current.abort();
            } catch {
                // Ignore abort errors
            }
        }
        
        // Cleanup VAD resources
        if (vadRef.current) {
          vadRef.current.stopMonitoring();
          vadRef.current.disconnect();
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {
            // Ignore close errors
          });
        }
    }
  }, []);


  const onTranscribeRef = useRef(onTranscribe);
  const onTranscriptionCompleteRef = useRef(onTranscriptionComplete);
  const onRecognitionErrorRef = useRef(onRecognitionError);

  useEffect(() => {
    onTranscribeRef.current = onTranscribe;
    onTranscriptionCompleteRef.current = onTranscriptionComplete;
    onRecognitionErrorRef.current = onRecognitionError;
  }, [onTranscribe, onTranscriptionComplete, onRecognitionError]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      // This is the INACTIVITY reminder. It fires only if no speech is ever detected.
      if (recognitionRef.current && stateRef.current === 'recording' && finalTranscriptRef.current === '') {
        onTranscriptionCompleteRef.current(""); // Pass empty string to signal inactivity
      }
    }, inactivityTimeout);
  }, [inactivityTimeout]);


  // Setup event listeners for the recognition instance
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    const handleStart = () => {
      setRecognitionState('recording');
      resetInactivityTimer();
    };

    const handleEnd = () => {
        setRecognitionState('idle');
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        
        // This ensures that if stopRecording() was called manually while the user was speaking,
        // any captured final transcript is still processed.
        const fullTranscript = finalTranscriptRef.current.trim();
        if (fullTranscript) {
           onTranscriptionCompleteRef.current(fullTranscript);
           finalTranscriptRef.current = '';
        }
    };
    
    const handleResult = (event: SpeechRecognitionEvent) => {
        // Any speech result (interim or final) means the user is not inactive.
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        // Clear the end-of-speech silence timer as well.
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        let interimTranscript = '';
        let finalTranscriptForThisResult = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const alternative = result[0];
          
          if (result.isFinal) {
            // Apply confidence filtering for final results
            if (enableVAD && alternative.confidence < vadConfigMerged.confidenceThreshold) {
              console.log(
                `[Whisper VAD] Filtered low-confidence: "${alternative.transcript}" (${alternative.confidence.toFixed(2)})`
              );
              continue; // Skip this result
            }
            finalTranscriptForThisResult += alternative.transcript + ' ';
          } else {
            // For interim results, only use if VAD confirms voice is active
            if (!enableVAD || isVoiceActiveRef.current) {
              interimTranscript += alternative.transcript;
            }
          }
        }
        
        // This is for barge-in. Pass interim results immediately (if VAD approves)
        const currentTranscript = (finalTranscriptRef.current + interimTranscript).trim();
        if (currentTranscript) {
          onTranscribeRef.current(currentTranscript);
        }
        
        finalTranscriptRef.current += finalTranscriptForThisResult;

        // This is the SILENCE detection for turn-taking. It detects the pause AFTER speech.
        silenceTimeoutRef.current = setTimeout(() => {
            const fullTranscript = finalTranscriptRef.current.trim();
            if (fullTranscript) {
              onTranscriptionCompleteRef.current(fullTranscript);
              finalTranscriptRef.current = '';
            }
        }, silenceTimeout);
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
        onRecognitionErrorRef.current?.(event);
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
          console.warn(`Speech recognition event: ${event.error}`);
        } else {
          toast({ variant: "destructive", title: "Speech Error", description: `Recognition failed: ${event.error}` });
        }
        setRecognitionState('idle'); // Ensure state is reset on error
    };

    recognition.onstart = handleStart;
    recognition.onend = handleEnd;
    recognition.onresult = handleResult;
    recognition.onerror = handleError;

    // Cleanup listeners when the component unmounts
    return () => {
        if(recognition) {
            recognition.onstart = null;
            recognition.onend = null;
            recognition.onresult = null;
            recognition.onerror = null;
        }
    };

  }, [toast, silenceTimeout, resetInactivityTimer, enableVAD, vadConfigMerged.confidenceThreshold]);


  const startRecording = useCallback(() => {
    if (recognitionRef.current && stateRef.current === 'idle') {
      try {
        finalTranscriptRef.current = '';
        onTranscribeRef.current(''); 
        
        // Initialize VAD if enabled
        if (enableVAD && !vadRef.current) {
          // Create audio context if needed
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
          }
          
          // Get user media with noise suppression
          navigator.mediaDevices
            .getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000,
                channelCount: 1,
              },
            })
            .then((stream) => {
              mediaStreamRef.current = stream;
              
              if (audioContextRef.current) {
                // Create VAD
                vadRef.current = new VoiceActivityDetector(
                  audioContextRef.current,
                  vadConfigMerged
                );
                
                // Connect audio source
                const source = audioContextRef.current.createMediaStreamSource(stream);
                vadRef.current.connectSource(source);
                
                // Start monitoring voice activity
                vadRef.current.startMonitoring(
                  () => {
                    // Voice detected
                    isVoiceActiveRef.current = true;
                    console.log('[Whisper VAD] Voice activity detected');
                  },
                  () => {
                    // Voice ended
                    isVoiceActiveRef.current = false;
                    console.log('[Whisper VAD] Voice activity ended');
                  }
                );
              }
            })
            .catch((err) => {
              console.error('[Whisper VAD] Failed to initialize VAD:', err);
              // Continue without VAD
            });
        }
        
        recognitionRef.current.start();
        setRecognitionState('recording');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
           console.warn("useWhisper: Recognition already started.");
        } else {
           console.error("useWhisper: Could not start speech recognition:", e);
           setRecognitionState('idle'); // Reset state if start fails
        }
      }
    }
  }, [enableVAD, vadConfigMerged]);


  const stopRecording = useCallback(() => {
    if (recognitionRef.current && (stateRef.current === 'recording' || stateRef.current === 'stopping')) {
      setRecognitionState('stopping');
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      
      // Cleanup VAD
      if (vadRef.current) {
        vadRef.current.stopMonitoring();
        vadRef.current.disconnect();
        vadRef.current = null;
      }
      
      // Stop media stream tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((err) => {
          console.warn('[Whisper VAD] Failed to close audio context:', err);
        });
        audioContextRef.current = null;
      }
      
      isVoiceActiveRef.current = false;
      
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("useWhisper: Exception during stop command.", e);
        setRecognitionState('idle'); 
      }
    }
  }, []);
  
  return {
    isRecording: recognitionState === 'recording',
    startRecording,
    stopRecording,
  };
}
