
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { useToast } from './use-toast';

const VOICE_SAMPLES_KEY = 'aiTeleSuiteVoiceSamples_v3'; // Version bump to clear old cache if needed

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
    const storedVoiceMap = new Map(samples.map(s => [s.id, s]));
    
    const samplesToGenerate = PRESET_VOICES.filter(
        p => !storedVoiceMap.has(p.id) || !storedVoiceMap.get(p.id)?.audioDataUri || storedVoiceMap.get(p.id)?.audioDataUri?.includes("error")
    );

    if (samplesToGenerate.length === 0) return;

    // Prevent re-triggering if already loading
    if (isLoading) return;

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
            return { ...sample, audioDataUri: `error-generating-sample` }; // Mark as failed
        })
    );

    setSamples(prevSamples => {
        const sampleMap = new Map(prevSamples.map(s => [s.id, s]));
        generatedSamples.forEach(gs => {
           if (gs.audioDataUri && !gs.audioDataUri.includes("error")) {
             sampleMap.set(gs.id, gs);
           }
        });
        return PRESET_VOICES.map(p => sampleMap.get(p.id) || p);
    });
    
    setIsLoading(false);
    toast({ title: "Voice Samples Ready", description: "Audio samples are now cached for instant playback." });

  }, [samples, setSamples, toast, isLoading]); // Added isLoading to dependency array

  return { samples, isLoading, initializeSamples };
}
