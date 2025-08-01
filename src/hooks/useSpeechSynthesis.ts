
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';

interface SpeakParams {
  text: string;
  voice?: SpeechSynthesisVoice; // Use the full voice object
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface CuratedVoice {
  name: string;
  voice: SpeechSynthesisVoice;
}

interface CuratedVoiceProfile {
  name: string;
  lang: string;
  gender: 'male' | 'female';
  isDefault?: boolean;
}

// Defines the ideal voices we want to find in the browser.
export const CURATED_VOICE_PROFILES: CuratedVoiceProfile[] = [
    { name: 'Indian English - Female (Professional)', lang: 'en-IN', gender: 'female', isDefault: true },
    { name: 'US English - Female (Professional)', lang: 'en-US', gender: 'female' },
    { name: 'Indian Hindi - Female', lang: 'hi-IN', gender: 'female' },
    { name: 'Indian English - Male (Professional)', lang: 'en-IN', gender: 'male' },
    { name: 'US English - Male (Professional)', lang: 'en-US', gender: 'male' },
    { name: 'Indian Hindi - Male', lang: 'hi-IN', gender: 'male' },
];


interface SpeechSynthesisHook {
  isSupported: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  curatedVoices: CuratedVoice[];
  speak: (params: SpeakParams) => void;
  cancel: () => void;
}

export const useSpeechSynthesis = (
  { onEnd }: { onEnd?: () => void } = {}
): SpeechSynthesisHook => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const handleVoicesChanged = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
            setAllVoices(availableVoices);
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
      if (allVoices.length === 0) return undefined;
      
      // Tier 1: Known high-quality voices by name (case-insensitive)
      const knownNames: { [key: string]: string[] } = {
          'en-IN-female': ['Microsoft Heera - English (India)', 'Google हिन्दी', 'Rishi'], // Google हिन्दी is often female
          'en-IN-male': ['Microsoft Ravi - English (India)', 'Google UK English Male'], // Fallback
          'en-US-female': ['Microsoft Zira - English (United States)', 'Google US English', 'Samantha'],
          'en-US-male': ['Microsoft David - English (United States)', 'Alex'],
          'hi-IN-female': ['Microsoft Kalpana - Hindi (India)', 'Google हिन्दी'],
          'hi-IN-male': ['Microsoft Hemant - Hindi (India)']
      };
      const targetKey = `${lang.toLowerCase()}-${gender}`;
      if (knownNames[targetKey]) {
          for (const name of knownNames[targetKey]) {
              const found = allVoices.find(v => v.name === name);
              if (found) return found;
          }
      }

      // Tier 2: Search by language and explicit gender keyword in the name
      const genderKeywords = {
          female: ['female', 'woman', 'fille', 'mujer', 'frau'],
          male: ['male', 'man', 'homme', 'hombre', 'mann']
      };

      const langFiltered = allVoices.filter(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));

      const specificMatch = langFiltered.find(v =>
          genderKeywords[gender].some(kw => v.name.toLowerCase().includes(kw))
      );
      if (specificMatch) return specificMatch;
      
      // Tier 3: Fallback to first voice matching the language, if no gender info is available in names
      if (langFiltered.length > 0) return langFiltered[0];

      return undefined;
  }, [allVoices]);

  const curatedVoices = useMemo((): CuratedVoice[] => {
    if (isLoading || allVoices.length === 0) return [];
    
    const uniqueVoices = new Map<string, CuratedVoice>();

    CURATED_VOICE_PROFILES.forEach(profile => {
        const bestMatch = findBestMatchingVoice(profile.lang, profile.gender);
        if (bestMatch && !uniqueVoices.has(profile.name)) {
             uniqueVoices.set(profile.name, {
                 name: profile.name,
                 voice: bestMatch,
             });
        }
    });

    return Array.from(uniqueVoices.values());
  }, [allVoices, isLoading, findBestMatchingVoice]);


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

  return { isSupported, isSpeaking, isLoading, curatedVoices, speak, cancel };
};
