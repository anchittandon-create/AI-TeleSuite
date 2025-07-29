
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

// These are the valid voice names for the Google Text-to-Speech API
export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    // Indian Voices
    { id: "en-IN-Wavenet-A", name: "Indian Female Voice (Standard)" },
    { id: "en-IN-Wavenet-C", name: "Indian Female Voice (Expressive)" },
    { id: "en-IN-Wavenet-B", name: "Indian Male Voice (Standard)" },
    { id: "en-IN-Wavenet-D", name: "Indian Male Voice (Expressive)" },
    
    // US Voices
    { id: "en-US-Wavenet-F", name: "US Female Voice 1 (Clear, Professional)" },
    { id: "en-US-Wavenet-G", name: "US Female Voice 2 (Warm, Friendly)" },
    { id: "en-US-Wavenet-H", name: "US Female Voice 3 (Bright, Energetic)" },
    { id: "en-US-Studio-M", name: "US Female Voice (Studio Quality)" },

    { id: "en-US-Wavenet-J", name: "US Male Voice 1 (Deep, Authoritative)" },
    { id: "en-US-Wavenet-A", name: "US Male Voice 2 (Clear, Neutral)" },
    { id: "en-US-Wavenet-B", name: "US Male Voice 3 (Friendly, Upbeat)" },
    { id: "en-US-Studio-O", name: "US Male Voice (Studio Quality)" },
];


export const BARK_PRESET_VOICES: VoiceSample[] = [
    { id: 'en_speaker_0', name: 'English Male 1'},
    { id: 'en_speaker_1', name: 'English Male 2'},
    { id: 'en_speaker_2', name: 'English Male 3'},
    { id: 'en_speaker_3', name: 'English Female 1'},
    { id: 'en_speaker_4', name: 'English Female 2'},
    { id: 'en_speaker_5', name: 'English Female 3'},
    { id: 'hi_speaker_0', name: 'Hindi Female 1'},
    { id: 'hi_speaker_1', name: 'Hindi Female 2'},
    { id: 'hi_speaker_3', name: 'Hindi Male 1'},
    { id: 'hi_speaker_4', name: 'Hindi Male 2'},
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
