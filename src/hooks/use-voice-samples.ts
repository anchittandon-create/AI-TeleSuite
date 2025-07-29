
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
    { id: "alnilam", name: "Female Voice 1 (Clear, Professional)" },
    { id: "callirrhoe", name: "Female Voice 2 (Warm, Friendly)" },
    { id: "vindemiatrix", name: "Female Voice 3 (Bright, Energetic)" },
    { id: "sadachbia", name: "Female Voice 4 (Calm, Measured)" },

    // Male Voices
    { id: "algenib", name: "Male Voice 1 (Deep, Authoritative)" },
    { id: "achernar", name: "Male Voice 2 (Clear, Neutral)" },
    { id: "gacrux", name: "Male Voice 3 (Friendly, Upbeat)" },
    { id: "achird", name: "Male Voice 4 (Calm, Soothing)" },
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

    