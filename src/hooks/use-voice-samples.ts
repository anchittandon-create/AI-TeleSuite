
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string; // This will now be a static path, e.g., "/voices/Algenib.wav"
}

// Updated with a variety of supported voices for the Genkit Gemini TTS model.
export const PRESET_VOICES: VoiceSample[] = [
    // Female Voices
    { id: "Algenib", name: "Female Voice 1" },
    { id: "Callirrhoe", name: "Female Voice 2" },
    { id: "Erinome", name: "Female Voice 3" },
    { id: "Leda", name: "Female Voice 4" },

    // Male Voices
    { id: "Achernar", name: "Male Voice 1" },
    { id: "Gacrux", name: "Male Voice 2" },
    { id: "Iapetus", name: "Male Voice 3" },
    { id: "Orus", name: "Male Voice 4" },
];

export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  // The state now holds the presets with their static paths.
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  // This callback now simply populates the audioDataUri with the expected static path.
  const initializeSamples = useCallback(() => {
    setIsLoading(true);
    const samplesWithPaths = PRESET_VOICES.map(voice => ({
      ...voice,
      audioDataUri: `/voices/${voice.id}.wav` // Point to the static file in the /public/voices directory
    }));
    setSamples(samplesWithPaths);
    setIsLoading(false); // Finished "loading" the paths
  }, []);

  // Run initialization once on mount
  useEffect(() => {
    initializeSamples();
  }, [initializeSamples]);


  // The hook's public interface remains the same, but the implementation is now much simpler and avoids API calls.
  return { samples, isLoading, initializeSamples };
}
