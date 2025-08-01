
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
  isLoading: boolean;
  voices: SpeechSynthesisVoice[];
  speak: (params: SpeakParams) => void;
  cancel: () => void;
}

export const useSpeechSynthesis = (
  { onEnd }: { onEnd?: () => void } = {}
): SpeechSynthesisHook => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const handleVoicesChanged = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
            setVoices(availableVoices);
            setIsLoading(false);
        }
      };
      
      // The voices might be loaded already.
      if (window.speechSynthesis.getVoices().length > 0) {
          handleVoicesChanged();
      } else {
        // Otherwise, wait for the event.
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      }

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const speak = useCallback(({ text, voiceURI, rate = 1, pitch = 1, volume = 1 }: SpeakParams) => {
    if (!isSupported || isSpeaking) return;
    
    const allAvailableVoices = window.speechSynthesis.getVoices();
    if (isLoading || allAvailableVoices.length === 0) {
        console.warn("Speech synthesis called before voices were loaded. Please try again.");
        return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voiceURI) {
      const voiceToUse = allAvailableVoices.find(v => v.voiceURI === voiceURI);
      if (voiceToUse) {
        utterance.voice = voiceToUse;
      } else {
        console.warn(`Could not find a suitable voice for URI '${voiceURI}'. Using browser default.`);
      }
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
      console.error('SpeechSynthesisUtterance.onerror', `Error: ${event.error}`, `Utterance text: "${text.substring(0, 50)}..."`, `Voice: ${utterance.voice?.name} (${utterance.voice?.lang})`);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isSupported, isSpeaking, onEnd, isLoading]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [isSupported]);

  return { isSupported, isSpeaking, isLoading, voices, speak, cancel };
};
