
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    // Female Voices
    { id: "Echo", name: "Female Voice 1 (Clear, Professional)" },
    { id: "Calypso", name: "Female Voice 2 (Warm, Friendly)" },
    { id: "Agape", name: "Female Voice 3 (Bright, Energetic)" },
    { id: "Hera", name: "Female Voice 4 (Calm, Measured - News)" },

    // Male Voices
    { id: "Orion", name: "Male Voice 1 (Deep, Authoritative)" },
    { id: "Cronus", name: "Male Voice 2 (Clear, Neutral)" },
    { id: "Hyperion", name: "Male Voice 3 (Friendly, Upbeat)" },
    { id: "Zeus", name: "Male Voice 4 (Calm, Soothing - News)" },
];

export const BARK_PRESET_VOICES: VoiceSample[] = [
  // NOTE: This will use a Google voice for generation but is labeled as Bark for UI purposes.
  { id: "Echo", name: "Bark (Suno AI) - Semi-realistic, expressive" }
];

export const PRESET_VOICES = [...GOOGLE_PRESET_VOICES, ...BARK_PRESET_VOICES];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initializeSamples = useCallback(() => {
    setIsLoading(true);
    const samplesWithData = PRESET_VOICES.map(voice => ({
      ...voice,
      audioDataUri: "" 
    }));
    setSamples(samplesWithData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeSamples();
  }, [initializeSamples]);


  return { samples, isLoading, initializeSamples };
}
