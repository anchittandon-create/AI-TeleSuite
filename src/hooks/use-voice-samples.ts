
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
    { id: "en-IN-Wavenet-A", name: "Indian Female Voice (Standard)" },
    { id: "en-IN-Wavenet-C", name: "Indian Female Voice (Expressive)" },
    { id: "en-US-Studio-M", name: "Studio Quality Female Voice" },


    // Male Voices
    { id: "en-US-Wavenet-J", name: "Male Voice 1 (Deep, Authoritative)" },
    { id: "en-US-Wavenet-A", name: "Male Voice 2 (Clear, Neutral)" },
    { id: "en-US-Wavenet-B", name: "Male Voice 3 (Friendly, Upbeat)" },
    { id: "en-US-Wavenet-D", name: "Male Voice 4 (Calm, Soothing)" },
    { id: "en-IN-Wavenet-B", name: "Indian Male Voice (Standard)" },
    { id: "en-IN-Wavenet-D", name: "Indian Male Voice (Expressive)" },
    { id: "en-US-Studio-O", name: "Studio Quality Male Voice" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initializeSamples = useCallback(() => {
    setIsLoading(true);
    // This function no longer fetches static files. It just sets up the structure.
    // The actual audio generation is handled by the API route on demand.
    const samplesWithData = GOOGLE_PRESET_VOICES.map(voice => ({
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
