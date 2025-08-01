
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
      
      // Known reliable voice names by platform/browser are the highest priority.
      const knownNames: { [key: string]: string[] } = {
          'en-IN-female': ['Microsoft Heera - English (India)', 'Google हिन्दी', 'Veena'], // Veena on macOS
          'en-IN-male': ['Microsoft Ravi - English (India)', 'Rishi'],
          'en-US-female': ['Microsoft Zira - English (United States)', 'Google US English', 'Samantha'],
          'en-US-male': ['Microsoft David - English (United States)', 'Alex'],
          'hi-IN-female': ['Microsoft Kalpana - Hindi (India)', 'Google हिन्दी', 'Lekha'],
          'hi-IN-male': ['Microsoft Hemant - Hindi (India)']
      };

      const genderKeywords = {
          female: ['female', 'woman', 'fille', 'mujer', 'frau', 'heera', 'zira', 'kalpana', 'veena', 'samantha', 'lekha', 'shweta', 'isha'],
          male: ['male', 'man', 'homme', 'hombre', 'mann', 'ravi', 'david', 'hemant', 'rishi', 'alex', 'nikhil']
      };

      const targetKey = `${lang.toLowerCase()}-${gender}`;
      
      // Tier 1: Find by known high-quality names first.
      if (knownNames[targetKey]) {
          for (const name of knownNames[targetKey]) {
              const found = allVoices.find(v => v.name === name);
              if (found) return found;
          }
      }

      const langFiltered = allVoices.filter(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));

      // Tier 2: Find by language and explicit gender keyword in name.
      const specificMatch = langFiltered.find(v =>
          genderKeywords[gender].some(kw => v.name.toLowerCase().includes(kw))
      );
      if (specificMatch) return specificMatch;
      
      // Tier 3: Find one that matches language but does NOT have an opposing gender keyword. This is a safer fallback.
      const opposingGender = gender === 'female' ? 'male' : 'female';
      const nonOpposingMatch = langFiltered.find(v => !genderKeywords[opposingGender].some(kw => v.name.toLowerCase().includes(kw)));
      if (nonOpposingMatch) return nonOpposingMatch;
      
      // Tier 4: Last resort. Just find the first one for the language. This might be wrong, but it's better than nothing.
      if (langFiltered.length > 0) {
        return langFiltered[0];
      }

      return undefined;
  }, [allVoices]);

  const curatedVoices = useMemo((): CuratedVoice[] => {
    if (isLoading || allVoices.length === 0) return [];
    
    const uniqueVoices = new Map<string, CuratedVoice>();

    CURATED_VOICE_PROFILES.forEach(profile => {
        const bestMatch = findBestMatchingVoice(profile.lang, profile.gender);
        // We ensure we only add a voice if we found a match and if that profile name hasn't been added yet.
        if (bestMatch && !uniqueVoices.has(profile.name)) {
             uniqueVoices.set(profile.name, {
                 name: profile.name, // The user-friendly name from our profile list
                 voice: bestMatch,    // The actual SpeechSynthesisVoice object from the browser
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
