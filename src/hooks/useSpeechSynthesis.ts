
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
  voice?: SpeechSynthesisVoice; // Use the full voice object
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
  findBestMatchingVoice: (lang: string, gender: 'male' | 'female') => SpeechSynthesisVoice | undefined;
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
      
      handleVoicesChanged(); // Try to get voices immediately
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      }

      return () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = null;
        }
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const findBestMatchingVoice = useCallback((lang: string, gender: 'male' | 'female'): SpeechSynthesisVoice | undefined => {
    if (isLoading || voices.length === 0) return undefined;
    
    // Prioritize voices that match both lang and a gender-indicative keyword in the name
    let bestMatch = voices.find(v => 
        v.lang.toLowerCase().startsWith(lang.toLowerCase()) && 
        v.name.toLowerCase().includes(gender)
    );
    if (bestMatch) return bestMatch;
    
    // Fallback: Find a voice that just matches the language
    bestMatch = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    return bestMatch;

  }, [voices, isLoading]);


  const speak = useCallback(({ text, voice, rate = 1, pitch = 1, volume = 1 }: SpeakParams) => {
    if (!isSupported || isSpeaking) return;
    
    if (isLoading) {
        console.warn("Speech synthesis called before voices were loaded. Please try again.");
        return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voice) {
      utterance.voice = voice;
    } else {
        console.warn(`No specific voice provided. Using browser default.`);
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

  return { isSupported, isSpeaking, isLoading, voices, speak, cancel, findBestMatchingVoice };
};
