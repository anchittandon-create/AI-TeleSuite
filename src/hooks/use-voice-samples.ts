
"use client";

export interface VoiceSample {
  id: string; 
  name: string; 
}

// Curated list of high-quality Google Cloud WaveNet voices for specific personas,
// supporting both English and Hinglish, and now including Hindi.
// This list has been corrected to accurately reflect the gender of each voice profile.
export const GOOGLE_PRESET_VOICES: VoiceSample[] = [
    // English (India) - High Quality WaveNet
    { id: "en-IN-Wavenet-A", name: "English (India) - Female 1" },
    { id: "en-IN-Wavenet-D", name: "English (India) - Female 2" },
    { id: "en-IN-Wavenet-B", name: "English (India) - Male 1" },
    { id: "en-IN-Wavenet-C", name: "English (India) - Male 2" },
    
    // Hindi (India) - High Quality WaveNet
    { id: "hi-IN-Wavenet-A", name: "Hindi (India) - Female 1" },
    { id: "hi-IN-Wavenet-D", name: "Hindi (India) - Female 2" },
    { id: "hi-IN-Wavenet-B", name: "Hindi (India) - Male 1" },
    { id: "hi-IN-Wavenet-C", name: "Hindi (India) - Male 2" },

    // English (US) - High Quality WaveNet for variety
    { id: "en-US-Wavenet-D", name: "English (US) - Male" },
    { id: "en-US-Wavenet-F", name: "English (US) - Female" },
];


export const SAMPLE_TEXT = "Hello, this is a sample of the selected voice that you can listen to for a preview.";
