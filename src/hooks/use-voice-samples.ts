
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { synthesizeSpeech } from '@/ai/flows/speech-synthesis-flow';
import { useToast } from './use-toast';

const VOICE_SAMPLES_KEY = 'aiTeleSuiteVoiceSamples_v10'; // Incremented version for new structure

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

// Updated with a variety of Indian English and Hindi voices.
export const PRESET_VOICES: VoiceSample[] = [
    // English Voices
    { id: "en-IN-Wavenet-D", name: "Indian English - Female 1" },
    { id: "en-IN-Wavenet-A", name: "Indian English - Female 2" },
    { id: "en-IN-Standard-D", name: "Indian English - Female 3 (Standard)" },
    { id: "en-IN-Standard-A", name: "Indian English - Female 4 (Standard)" },
    { id: "en-IN-Wavenet-B", name: "Indian English - Male 1" },
    { id: "en-IN-Wavenet-C", name: "Indian English - Male 2" },
    { id: "en-IN-Standard-B", name: "Indian English - Male 3 (Standard)" },
    { id: "en-IN-Standard-C", name: "Indian English - Male 4 (Standard)" },
    // Hindi Voices (These will speak the English sample text in a Hindi accent)
    { id: "hi-IN-Wavenet-D", name: "Indian Hindi - Female 1" },
    { id: "hi-IN-Wavenet-A", name: "Indian Hindi - Female 2" },
    { id: "hi-IN-Wavenet-B", name: "Indian Hindi - Male 1" },
    { id: "hi-IN-Wavenet-C", name: "Indian Hindi - Male 2" },
];


const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  const [samples, setSamples] = useLocalStorage<VoiceSample[]>(VOICE_SAMPLES_KEY, PRESET_VOICES);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initializeSamples = useCallback(async () => {
    // sessionStorage ensures this check is per-tab session, preventing parallel runs
    if (sessionStorage.getItem('voiceSamplesLoadingOrLoaded_v7') === 'true' || isLoading) {
      return;
    }

    const storedVoiceMap = new Map(samples.map(s => [s.id, s]));
    
    // Find which samples are missing a valid, non-error audio URI
    const samplesToGenerate = PRESET_VOICES.filter(
        p => {
          const sample = storedVoiceMap.get(p.id);
          return !sample || !sample.audioDataUri || sample.audioDataUri.includes("error");
        }
    );

    if (samplesToGenerate.length === 0) {
        sessionStorage.setItem('voiceSamplesLoadingOrLoaded_v7', 'true');
        return; // All samples are already cached and valid in localStorage
    }

    setIsLoading(true);
    sessionStorage.setItem('voiceSamplesLoadingOrLoaded_v7', 'true'); 
    
    toast({ title: "Preparing Voice Samples", description: `Generating audio for ${samplesToGenerate.length} preset voices. This happens once if needed.` });
    
    const generatedSamples = await Promise.all(
        samplesToGenerate.map(async (sample) => {
            try {
                const result = await synthesizeSpeech({ textToSpeak: SAMPLE_TEXT, voiceProfileId: sample.id });
                if (result.audioDataUri && !result.errorMessage) {
                    return { ...sample, audioDataUri: result.audioDataUri };
                }
                 return { ...sample, audioDataUri: `error-generating-sample:${result.errorMessage || 'Unknown error'}` };
            } catch (error) {
                console.error(`Failed to generate sample for voice ${sample.id}`, error);
                return { ...sample, audioDataUri: `error-generating-sample:Unknown` };
            }
        })
    );

    // Update the localStorage state with the newly generated samples
    setSamples(prevSamples => {
        const sampleMap = new Map(prevSamples.map(s => [s.id, s]));
        generatedSamples.forEach(gs => {
           sampleMap.set(gs.id, gs);
        });
        return PRESET_VOICES.map(p => sampleMap.get(p.id) || p); // Ensure order and completeness
    });
    
    setIsLoading(false);
    const successfulCount = generatedSamples.filter(s => s.audioDataUri && !s.audioDataUri.includes("error")).length;
    if (successfulCount > 0) {
        toast({ title: "Voice Samples Ready", description: `${successfulCount} audio sample(s) are now cached for instant playback.` });
    }
    if (successfulCount < samplesToGenerate.length) {
        toast({ variant: "destructive", title: "Some Voice Samples Failed", description: "Some preset voices could not be generated due to an error. Please check server logs."})
    }
  }, [samples, setSamples, toast, isLoading]);

  return { samples, isLoading, initializeSamples };
}
