
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

// Curated list of high-quality Google TTS-3 voices for specific personas,
// compatible with the gemini-2.5-flash-preview-tts model.
export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    { id: "Algenib", name: "Male - Warm, Professional" },
    { id: "Rasalgethi", name: "Male - Deep, Authoritative" },
    { id: "Achernar", name: "Female - Clear, Professional" },
    { id: "Enif", name: "Female - Calm, Friendly" },
    { id: "Sadachbia", name: "Male - Standard, Neutral" },
    { id: "Schedar", name: "Female - Standard, Neutral" },
    { id: "Umbriel", name: "Male - Youthful, Energetic" },
    { id: "Vindemiatrix", name: "Female - Youthful, Energetic" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";
