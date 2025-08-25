
"use client";

import type { SynthesizeSpeechOutput } from '@/types';

/**
 * Client-side fetcher for the TTS API route.
 * @param textToSpeak The text to be converted to speech.
 * @param voiceProfileId The ID of the Google Cloud TTS voice to use.
 * @returns A promise that resolves to a SynthesizeSpeechOutput object.
 */
export async function synthesizeSpeechOnClient(textToSpeak: string, voiceProfileId: string): Promise<SynthesizeSpeechOutput> {
  try {
    if (!textToSpeak.trim()) {
      return { text: textToSpeak, audioDataUri: '', voiceProfileId, errorMessage: "Input text is empty." };
    }

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textToSpeak, voice: voiceProfileId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `TTS API route returned an error: ${response.status} ${response.statusText}` }));
        throw new Error(errorData.error || `TTS API route returned a ${response.status} status.`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (!data.audioDataUri) {
       throw new Error("TTS API route did not return any audio data.");
    }

    return {
      text: textToSpeak,
      audioDataUri: data.audioDataUri,
      voiceProfileId: voiceProfileId,
    };
  } catch (error: any) {
    console.error("Error calling /api/tts from client:", error);
    return {
      text: textToSpeak,
      audioDataUri: '',
      errorMessage: `[TTS Client Error]: Could not generate audio. Error: ${error.message}`,
      voiceProfileId,
    };
  }
}
