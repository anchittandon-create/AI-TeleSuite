
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { useToast } from './use-toast';

const VOICE_SAMPLES_KEY = 'aiTeleSuiteVoiceSamples_v1';

export interface VoiceSample {
  id: string; // e.g., 'Algenib'
  name: string; // e.g., 'Indian English - Male (Premium, Gemini)'
  audioDataUri?: string;
}

export const PRESET_VOICES = [
    { id: "Algenib", name: "Indian English - Male (Premium, Gemini)" },
    { id: "Achernar", name: "Indian English - Female (Premium, Gemini)" },
];

const SAMPLE_TEXT = "Hello, this is a sample of the selected voice.";

export function useVoiceSamples() {
  const [samples, setSamples] = useLocalStorage<VoiceSample[]>(VOICE_SAMPLES_KEY, PRESET_VOICES);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initializeSamples = useCallback(async () => {
    const samplesToGenerate = samples.filter(s => !s.audioDataUri);
    if (samplesToGenerate.length === 0) {
      return;
    }

    setIsLoading(true);
    toast({ title: "Preparing Voice Samples", description: "Generating audio for preset voices for the first time. This may take a moment..." });
    
    const generatedSamples = await Promise.all(
        samplesToGenerate.map(async (sample) => {
            try {
                const result = await synthesizeSpeech({ textToSpeak: SAMPLE_TEXT, voiceProfileId: sample.id });
                if (result.audioDataUri && !result.errorMessage) {
                    return { ...sample, audioDataUri: result.audioDataUri };
                }
            } catch (error) {
                console.error(`Failed to generate sample for voice ${sample.id}`, error);
            }
            return sample; // Return original sample if generation fails
        })
    );

    setSamples(prevSamples => {
        const sampleMap = new Map(prevSamples.map(s => [s.id, s]));
        generatedSamples.forEach(gs => {
            if (gs.audioDataUri) {
                sampleMap.set(gs.id, gs);
            }
        });
        return Array.from(sampleMap.values());
    });
    
    setIsLoading(false);
    toast({ title: "Voice Samples Ready", description: "Audio samples are now cached for instant playback." });

  }, [samples, setSamples, toast]);

  return { samples, isLoading, initializeSamples };
}
