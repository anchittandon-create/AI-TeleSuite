
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string; // This will now be a static path, e.g., "/voices/en-IN-Wavenet-D.wav"
}

// Updated with a variety of Indian English and Hindi voices. This is the single source of truth.
export const PRESET_VOICES: VoiceSample[] = [
    // English Voices (Female)
    { id: "en-IN-Standard-D", name: "Indian English - Female 1" },
    { id: "en-IN-Standard-A", name: "Indian English - Female 2" },
    { id: "en-IN-Wavenet-A", name: "Indian English - Female 3 (WaveNet)" },
    { id: "en-IN-Wavenet-D", name: "Indian English - Female 4 (WaveNet)" },

    // English Voices (Male)
    { id: "en-IN-Standard-B", name: "Indian English - Male 1" },
    { id: "en-IN-Standard-C", name: "Indian English - Male 2" },
    { id: "en-IN-Wavenet-B", name: "Indian English - Male 3 (WaveNet)" },
    { id: "en-IN-Wavenet-C", name: "Indian English - Male 4 (WaveNet)" },
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
