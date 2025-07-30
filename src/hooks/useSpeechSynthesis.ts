
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface Voice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

interface SpeakParams {
  text: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface SpeechSynthesisHook {
  isSupported: boolean;
  isSpeaking: boolean;
  voices: Voice[];
  speak: (params: SpeakParams) => void;
  cancel: () => void;
}

export const useSpeechSynthesis = (
  { onEnd }: { onEnd?: () => void } = {}
): SpeechSynthesisHook => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const handleVoicesChanged = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      };

      // Initial load
      handleVoicesChanged();

      // Subscribe to changes
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const speak = useCallback(({ text, voiceURI, rate = 1, pitch = 1, volume = 1 }: SpeakParams) => {
    if (!isSupported || isSpeaking) return;

    // Cancel any ongoing speech before starting a new one
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    
    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isSupported, isSpeaking, voices, onEnd]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [isSupported]);

  return { isSupported, isSpeaking, voices, speak, cancel };
};
