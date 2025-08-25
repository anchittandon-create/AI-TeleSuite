
"use client";

export interface VoiceSample {
  id: string; 
  name: string; 
}

// Curated list of high-quality Google Cloud Standard voices for specific personas,
// supporting both English and Hinglish. These are compatible with the standard
// Text-to-Speech API.
export const PRESET_VOICES: VoiceSample[] = [
    { id: "en-IN-Wavenet-D", name: "Male - Professional (India, en-IN)" },
    { id: "en-IN-Wavenet-B", name: "Male - Calm (India, en-IN)" },
    { id: "en-IN-Wavenet-C", name: "Female - Professional (India, en-IN)" },
    { id: "en-IN-Wavenet-A", name: "Female - Calm (India, en-IN)" },
    { id: "en-US-Wavenet-D", name: "Male - Professional (US, en-US)" },
    { id: "en-US-Wavenet-J", name: "Male - Calm (US, en-US)" },
    { id: "en-US-Wavenet-F", name: "Female - Professional (US, en-US)" },
    { id: "en-US-Wavenet-E", name: "Female - Calm (US, en-US)" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to for a preview.";
