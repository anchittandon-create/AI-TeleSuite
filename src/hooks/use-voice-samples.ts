
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { useToast } from './use-toast';

const VOICE_SAMPLES_KEY = 'aiTeleSuiteVoiceSamples_v5'; // Incremented version to force re-fetch on new logic

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

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
    // sessionStorage ensures this check is per-tab session, preventing multiple tabs from triggering it simultaneously on load.
    if (sessionStorage.getItem('voiceSamplesLoadingOrLoaded_v2') === 'true' || isLoading) {
      return;
    }

    const storedVoiceMap = new Map(samples.map(s => [s.id, s]));
    
    // Check if ALL preset voices have valid, non-error audioDataUris
    const allSamplesGenerated = PRESET_VOICES.every(
        p => {
          const sample = storedVoiceMap.get(p.id);
          return sample && sample.audioDataUri && !sample.audioDataUri.includes("error");
        }
    );

    if (allSamplesGenerated) {
      sessionStorage.setItem('voiceSamplesLoadingOrLoaded_v2', 'true');
      return; // All good, no need to generate
    }

    const samplesToGenerate = PRESET_VOICES.filter(
      p => !storedVoiceMap.has(p.id) || !storedVoiceMap.get(p.id)?.audioDataUri || storedVoiceMap.get(p.id)?.audioDataUri?.includes("error")
    );

    if (samplesToGenerate.length === 0) {
        sessionStorage.setItem('voiceSamplesLoadingOrLoaded_v2', 'true');
        return; // Nothing to generate
    }


    setIsLoading(true);
    sessionStorage.setItem('voiceSamplesLoadingOrLoaded_v2', 'true'); // Mark as "attempted" for this session
    
    toast({ title: "Preparing Voice Samples", description: `Generating audio for ${samplesToGenerate.length} preset voices... This happens once per session if needed.` });
    
    const generatedSamples = await Promise.all(
        samplesToGenerate.map(async (sample) => {
            try {
                const result = await synthesizeSpeech({ textToSpeak: SAMPLE_TEXT, voiceProfileId: sample.id });
                if (result.audioDataUri && !result.errorMessage) {
                    return { ...sample, audioDataUri: result.audioDataUri };
                }
                 // If there's an error, return a placeholder to mark it as failed
                 return { ...sample, audioDataUri: `error-generating-sample:${result.errorMessage}` };
            } catch (error) {
                console.error(`Failed to generate sample for voice ${sample.id}`, error);
                return { ...sample, audioDataUri: `error-generating-sample:Unknown` };
            }
        })
    );

    setSamples(prevSamples => {
        const sampleMap = new Map(prevSamples.map(s => [s.id, s]));
        generatedSamples.forEach(gs => {
           sampleMap.set(gs.id, gs);
        });
        return PRESET_VOICES.map(p => sampleMap.get(p.id) || p);
    });
    
    setIsLoading(false);
    const successfulCount = generatedSamples.filter(s => s.audioDataUri && !s.audioDataUri.includes("error")).length;
    if (successfulCount > 0) {
        toast({ title: "Voice Samples Ready", description: `${successfulCount} audio samples are now cached for instant playback.` });
    }
    if (successfulCount < samplesToGenerate.length) {
        toast({ variant: "destructive", title: "Some Voice Samples Failed", description: "Some preset voices could not be generated due to an error. Please check server logs and ensure the TTS server is running."})
    }
  }, [samples, setSamples, toast, isLoading]);

  return { samples, isLoading, initializeSamples };
}
