
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

// These are the valid voice names for the Google Text-to-Speech API
export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    // Female Voices
    { id: "en-US-Wavenet-F", name: "Female Voice 1 (Clear, Professional)" },
    { id: "en-US-Wavenet-G", name: "Female Voice 2 (Warm, Friendly)" },
    { id: "en-US-Wavenet-H", name: "Female Voice 3 (Bright, Energetic)" },
    { id: "en-US-Wavenet-I", name: "Female Voice 4 (Calm, News-like)" },

    // Male Voices
    { id: "en-US-Wavenet-J", name: "Male Voice 1 (Deep, Authoritative)" },
    { id: "en-US-Wavenet-A", name: "Male Voice 2 (Clear, Neutral)" },
    { id: "en-US-Wavenet-B", name: "Male Voice 3 (Friendly, Upbeat)" },
    { id: "en-US-Wavenet-D", name: "Male Voice 4 (Calm, Soothing)" },
];

// Bark is simulated for the UI. It uses a Google voice for actual generation.
export const BARK_PRESET_VOICES: VoiceSample[] = [
  // The 'id' here MUST match a valid ID from GOOGLE_PRESET_VOICES to ensure it can generate audio.
  // We use "Echo" from the previous implementation, which is now mapped to a valid Google ID.
  // Let's use a clear, professional female voice for the Bark simulation.
  { id: "Echo", name: "Bark (Suno AI) - Semi-realistic, expressive" }
];

export const PRESET_VOICES = [...GOOGLE_PRESET_VOICES, ...BARK_PRESET_VOICES];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initializeSamples = useCallback(() => {
    setIsLoading(true);
    // This function no longer fetches static files. It just sets up the structure.
    // The actual audio generation is handled by the API route on demand.
    const samplesWithData = PRESET_VOICES.map(voice => ({
      ...voice,
      audioDataUri: "" // Will be populated by the API call when sample is played
    }));
    setSamples(samplesWithData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeSamples();
  }, [initializeSamples]);


  return { samples, isLoading, initializeSamples };
}
