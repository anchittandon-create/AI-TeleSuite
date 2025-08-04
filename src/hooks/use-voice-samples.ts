
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
    { id: "en-IN-Wavenet-D", name: "Female - Indian English (High Quality)" },
    { id: "en-IN-Wavenet-A", name: "Female - Indian English (Standard)" },
    { id: "en-IN-Wavenet-B", name: "Male - Indian English (Standard)" },
    { id: "en-IN-Wavenet-C", name: "Male - Indian English (Warm)" },
    { id: "en-US-Wavenet-F", name: "Female - US English (Pleasant)" },
    { id: "en-US-Wavenet-E", name: "Female - US English (Calm)" },
    { id: "en-US-Wavenet-D", name: "Male - US English (Standard)" },
    { id: "en-US-Wavenet-A", name: "Male - US English (Warm)" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to.";
