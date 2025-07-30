
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

// Curated list of high-quality Google TTS voices for English (India/US) and Hindi.
export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    // English (India) Voices
    { id: "en-IN-Wavenet-A", name: "English (India) - Female" },
    { id: "en-IN-Wavenet-D", name: "English (India) - Male" },
    
    // English (US) Voices
    { id: "en-US-Wavenet-F", name: "English (US) - Female" },
    { id: "en-US-Wavenet-J", name: "English (US) - Male" },
    { id: "en-US-Studio-M", name: "English (US) - Female (Studio)" },
    { id: "en-US-Studio-O", name: "English (US) - Male (Studio)" },

    // Hindi (India) Voices
    { id: "hi-IN-Wavenet-A", name: "Hindi (India) - Female" },
    { id: "hi-IN-Wavenet-D", name: "Hindi (India) - Male" },
    { id: "hi-IN-Wavenet-B", name: "Hindi (India) - Male 2" },
    { id: "hi-IN-Wavenet-C", name: "Hindi (India) - Female 2" },
];


// This list is kept for reference but the primary voice agent now uses the Google voices above.
export const BARK_PRESET_VOICES: VoiceSample[] = [
    { id: 'en_speaker_0', name: 'English Male 1'},
    { id: 'en_speaker_1', name: 'English Male 2'},
    { id: 'en_speaker_3', name: 'English Female 1'},
    { id: 'en_speaker_4', name: 'English Female 2'},
    { id: 'hi_speaker_0', name: 'Hindi Female 1'},
    { id: 'hi_speaker_3', name: 'Hindi Male 1'},
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
