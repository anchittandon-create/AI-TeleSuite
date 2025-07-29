
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string; // This will now be a static path, e.g., "/voices/alnilam.wav"
}

// **FIX**: Replaced with a list of valid, supported voice names from the Gemini TTS API documentation.
// This prevents the "400 Bad Request" error for unsupported voice names.
export const PRESET_VOICES: VoiceSample[] = [
    // Female Voices
    { id: "en-US-Wavenet-F", name: "Female Voice 1 (Clear, Professional)" },
    { id: "en-US-Wavenet-G", name: "Female Voice 2 (Warm, Friendly)" },
    { id: "en-US-Wavenet-H", name: "Female Voice 3 (Bright, Energetic)" },
    { id: "en-US-News-K", name: "Female Voice 4 (Calm, Measured - News)" },

    // Male Voices
    { id: "en-US-Wavenet-D", name: "Male Voice 1 (Deep, Authoritative)" },
    { id: "en-US-Wavenet-B", name: "Male Voice 2 (Clear, Neutral)" },
    { id: "en-US-Wavenet-I", name: "Male Voice 3 (Friendly, Upbeat)" },
    { id: "en-US-News-N", name: "Male Voice 4 (Calm, Soothing - News)" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";

export function useVoiceSamples() {
  // The state now holds the presets with their static paths.
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  // This callback now simply populates the audioDataUri with the expected static path.
  const initializeSamples = useCallback(() => {
    setIsLoading(true);
    const samplesWithData = PRESET_VOICES.map(voice => ({
      ...voice,
      audioDataUri: "" // This will be populated dynamically now
    }));
    setSamples(samplesWithData);
    setIsLoading(false); // Finished "loading" the paths
  }, []);

  // Run initialization once on mount
  useEffect(() => {
    initializeSamples();
  }, [initializeSamples]);


  // The hook's public interface remains the same, but the implementation is now much simpler and avoids API calls.
  return { samples, isLoading, initializeSamples };
}
