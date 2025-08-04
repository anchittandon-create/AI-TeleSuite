
"use client";

import { useState, useEffect, useCallback } from 'react';

export interface VoiceSample {
  id: string; 
  name: string; 
  audioDataUri?: string;
}

// Curated list of high-quality Google Wavenet voices for specific personas.
// These IDs are passed to the server-side TTS API.
export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    { id: "en-IN-Wavenet-D", name: "Indian English - Female (High Quality)" },
    { id: "en-IN-Wavenet-A", name: "Indian English - Female (Standard)" },
    { id: "en-IN-Wavenet-B", name: "Indian English - Male (Standard)" },
    { id: "en-IN-Wavenet-C", name: "Indian English - Male (Warm)" },
    { id: "en-US-Wavenet-F", name: "US English - Female (Pleasant)" },
    { id: "en-US-Wavenet-E", name: "US English - Female (Calm)" },
    { id: "en-US-Wavenet-D", name: "US English - Male (Standard)" },
    { id: "en-US-Wavenet-A", name: "US English - Male (Warm)" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";
