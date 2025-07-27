
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { useToast } from './use-toast';

const VOICE_SAMPLES_KEY = 'aiTeleSuiteVoiceSamples_v2'; // Version bump to clear old cache

export interface VoiceSample {
  id: string; // e.g., 'en-IN-Wavenet-A'
  name: string; // e.g., 'Indian English - Female A'
  audioDataUri?: string;
}

// Updated list of high-quality Google Cloud TTS voices
export const PRESET_VOICES: VoiceSample[] = [
    { id: "en-IN-Wavenet-D", name: "Indian English - Male (Standard)" },
    { id: "en-IN-Wavenet-A", name: "Indian English - Female (Standard)" },
    { id: "en-IN-Wavenet-B", name: "Indian English - Male (Alternate)" },
    { id: "en-IN-Wavenet-C", name: "Indian English - Female (Alternate)" },
];

const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  const [samples, setSamples] = useLocalStorage<VoiceSample[]>(VOICE_SAMPLES_KEY, PRESET_VOICES);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initializeSamples = useCallback(async () => {
    // Check if any of the preset voices are missing from the stored samples or lack audio data
    const presetVoiceIds = new Set(PRESET_VOICES.map(p => p.id));
    const storedVoiceMap = new Map(samples.map(s => [s.id, s]));
    
    const samplesToGenerate = PRESET_VOICES.filter(
        p => !storedVoiceMap.has(p.id) || !storedVoiceMap.get(p.id)?.audioDataUri
    );

    if (samplesToGenerate.length === 0) {
      // Ensure the displayed samples are up-to-date with PRESET_VOICES, in case a new one was added
      if (samples.length !== PRESET_VOICES.length) {
          setSamples(PRESET_VOICES.map(p => storedVoiceMap.get(p.id) || p));
      }
      return;
    }

    setIsLoading(true);
    toast({ title: "Preparing Voice Samples", description: `Generating audio for ${samplesToGenerate.length} preset voices. This may take a moment...` });
    
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
           sampleMap.set(gs.id, gs);
        });
        // Ensure the final list matches the order and content of PRESET_VOICES
        return PRESET_VOICES.map(p => sampleMap.get(p.id) || p);
    });
    
    setIsLoading(false);
    toast({ title: "Voice Samples Ready", description: "Audio samples are now cached for instant playback." });

  }, [samples, setSamples, toast]);

  return { samples, isLoading, initializeSamples };
}
