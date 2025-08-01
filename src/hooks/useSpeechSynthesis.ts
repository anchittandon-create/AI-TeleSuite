
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
  voices: Voice[];
  speak: (params: SpeakParams) => void;
  cancel: () => void;
}

const findBestMatchingVoice = (
  allVoices: SpeechSynthesisVoice[],
  preferredURI: string,
  preferredLang: string,
  preferredName: string
): SpeechSynthesisVoice | undefined => {
  // 1. Perfect Match: Try to find by the exact URI. This is the most reliable.
  const perfectMatch = allVoices.find(v => v.voiceURI === preferredURI);
  if (perfectMatch) {
    return perfectMatch;
  }

  // 2. Fallback Logic: If perfect match fails, find the best alternative.
  const lowerCaseName = preferredName.toLowerCase();
  const isFemale = lowerCaseName.includes("female");
  const isMale = lowerCaseName.includes("male");

  const candidates = allVoices.filter(v => v.lang.startsWith(preferredLang));

  if (candidates.length === 0) return undefined; // No voices for this language at all.

  // Filter by gender if specified
  let genderCandidates = candidates;
  if (isFemale || isMale) {
    genderCandidates = candidates.filter(v => {
        const name = v.name.toLowerCase();
        if (isFemale) return name.includes('female');
        if (isMale) return name.includes('male');
        return false;
    });
    if (genderCandidates.length === 0) {
        genderCandidates = candidates; // If no gender match, revert to all language candidates
    }
  }

  // Prioritize high-quality voices if possible
  const highQuality = genderCandidates.find(v => v.name.toLowerCase().includes('premium') || v.name.toLowerCase().includes('wavenet'));
  if (highQuality) return highQuality;

  // Prioritize Google voices as they are often high quality
  const googleVoice = genderCandidates.find(v => v.name.toLowerCase().startsWith('google'));
  if (googleVoice) return googleVoice;
  
  // Return the first available candidate for the language/gender
  return genderCandidates[0];
};


export const useSpeechSynthesis = (
  { onEnd }: { onEnd?: () => void } = {}
): SpeechSynthesisHook => {
  const [voices, setVoices] = useState<Voice[]>([]);
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
    
    if (isLoading || voices.length === 0) {
        console.warn("Speech synthesis called before voices were loaded. Please try again.");
        return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voiceURI) {
      const allAvailableVoices = window.speechSynthesis.getVoices();
      const preferredVoiceFromCuratedList = {
          voiceURI: "Microsoft Heera - English (India)", // Default fallback
          name: "Indian English - Female",
          lang: "en-IN",
          ...allVoices.find(v => v.voiceURI === voiceURI)
      };

      const voiceToUse = findBestMatchingVoice(
          allAvailableVoices,
          preferredVoiceFromCuratedList.voiceURI,
          preferredVoiceFromCuratedList.lang,
          preferredVoiceFromCuratedList.name
      );

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
  }, [isSupported, isSpeaking, voices, onEnd, isLoading]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [isSupported]);

  return { isSupported, isSpeaking, isLoading, voices, speak, cancel };
};
