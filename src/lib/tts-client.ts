
"use client";

import { useToast } from "@/hooks/use-toast";

interface SynthesisRequest {
  text: string;
  voice?: string; // e.g., 'en-IN-Wavenet-D'
}

interface SynthesisResponse {
  audioDataUri: string;
}

/**
 * Calls the internal Next.js API route to synthesize speech.
 * @param request The text and optional voice configuration.
 * @returns A promise that resolves with an object containing the audioDataUri.
 * @throws An error if the synthesis fails.
 */
export async function synthesizeSpeechOnClient(request: SynthesisRequest): Promise<SynthesisResponse> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `TTS API route returned an error: ${response.status} ${response.statusText}` }));
        throw new Error(errorData.error || `TTS API route returned a ${response.status} status.`);
    }
    
    const data = await response.json();

    if (!data.audioDataUri) {
        throw new Error("Received an invalid response from the TTS API route.");
    }
    
    return data;
  } catch (error) {
    console.error("Error in synthesizeSpeechOnClient:", error);
    // Re-throw the error so the calling component can handle it (e.g., show a toast)
    throw error;
  }
}
