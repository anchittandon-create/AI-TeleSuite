
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';

interface SpeakParams {
  text: string;
  voice?: SpeechSynthesisVoice; // Use the full voice object
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface CuratedVoiceProfile {
  name: string;
  lang: string;
  gender: 'male' | 'female';
  isDefault?: boolean;
}

// Defines the ideal voices we want to find in the browser.
const CURATED_VOICE_PROFILES: CuratedVoiceProfile[] = [
    { name: 'Indian English - Female (Professional)', lang: 'en-IN', gender: 'female', isDefault: true },
    { name: 'Indian English - Male (Professional)', lang: 'en-IN', gender: 'male' },
    { name: 'US English - Female (Professional)', lang: 'en-US', gender: 'female' },
    { name: 'US English - Male (Professional)', lang: 'en-US', gender: 'male' },
    { name: 'Indian Hindi - Female', lang: 'hi-IN', gender: 'female' },
    { name: 'Indian Hindi - Male', lang: 'hi-IN', gender: 'male' },
];


interface SpeechSynthesisHook {
  isSupported: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  curatedVoices: SpeechSynthesisVoice[];
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
    
    // Prioritize voices that match both lang and a gender-indicative keyword in the name
    let bestMatch = allVoices.find(v => 
        v.lang.toLowerCase().startsWith(lang.toLowerCase()) && 
        v.name.toLowerCase().includes(gender) &&
        !v.name.toLowerCase().includes("google") // Often less natural
    );
    if (bestMatch) return bestMatch;

    // Fallback 1: Any voice with matching language and gender
    bestMatch = allVoices.find(v => 
        v.lang.toLowerCase().startsWith(lang.toLowerCase()) && 
        v.name.toLowerCase().includes(gender)
    );
    if(bestMatch) return bestMatch;
    
    // Fallback 2: Any voice that just matches the language
    bestMatch = allVoices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    return bestMatch;

  }, [allVoices]);

  const curatedVoices = useMemo(() => {
    if (isLoading || allVoices.length === 0) return [];
    
    const uniqueVoices = new Map<string, SpeechSynthesisVoice>();

    CURATED_VOICE_PROFILES.forEach(profile => {
        const bestMatch = findBestMatchingVoice(profile.lang, profile.gender);
        if (bestMatch && !uniqueVoices.has(profile.name)) {
             // We create a new object to avoid modifying the original voice object
             // But we need to use the actual SpeechSynthesisVoice object from the browser
             const curatedVoice = Object.create(Object.getPrototypeOf(bestMatch));
             Object.assign(curatedVoice, bestMatch, { name: profile.name, isDefault: profile.isDefault });
             uniqueVoices.set(profile.name, curatedVoice);
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
      // Find the real voice object from the browser's list
      const actualVoice = allVoices.find(v => v.voiceURI === voice.voiceURI);
      if (actualVoice) {
        utterance.voice = actualVoice;
      } else {
        console.warn(`Voice "${voice.name}" not found in browser's available voices. Using default.`);
      }
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
  }, [isSupported, isSpeaking, onEnd, isLoading, allVoices]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [isSupported]);

  return { isSupported, isSpeaking, isLoading, curatedVoices, speak, cancel };
};
