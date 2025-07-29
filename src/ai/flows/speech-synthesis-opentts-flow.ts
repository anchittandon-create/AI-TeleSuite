
'use server';
/**
 * @fileOverview Speech synthesis flow for OpenTTS. This flow now correctly handles
 * client-side audio processing.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput } from '@/types';
import type { SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64';


const OpenTTSSpeechSchema = z.object({
  textToSpeak: z.string(),
  voice: z.string(),
});

/**
 * Converts an ArrayBuffer to a Base64 string, suitable for creating a Data URI.
 * This is the correct browser-compatible way to handle binary data.
 * @param buffer The ArrayBuffer to convert.
 * @returns A Base64 encoded string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return Base64.btoa(binary);
}


const synthesizeSpeechWithOpenTTSFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechWithOpenTTSFlow',
    inputSchema: OpenTTSSpeechSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async ({ textToSpeak, voice }): Promise<SynthesizeSpeechOutput> => {
    const openTtsUrl = 'http://localhost:5500/api/tts';
    
    try {
      const response = await fetch(`${openTtsUrl}?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(textToSpeak)}`, {
        method: 'POST', // Use POST for reliability
      });
 
      if (!response.ok) {
        throw new Error(`OpenTTS server responded with status: ${response.status} ${response.statusText}`);
      }
 
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = arrayBufferToBase64(audioBuffer);
      
      return {
        text: textToSpeak,
        audioDataUri: `data:audio/wav;base64,${audioBase64}`,
        voiceProfileId: voice,
      };
 
    } catch (error: any) {
      console.error("Error synthesizing speech with OpenTTS (from flow):", error);
      const errorMessage = `[OpenTTS Service Error]: Could not generate audio. Please ensure your local OpenTTS server is running and accessible at ${openTtsUrl}. Error: ${error.message}`;
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:${errorMessage}`,
        errorMessage: errorMessage,
        voiceProfileId: voice
      };
    }
  }
);


export async function synthesizeSpeechWithOpenTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
   const { textToSpeak, voiceProfileId } = input;
   // Default to a common OpenTTS voice if none is provided
   const voiceToUse = voiceProfileId || 'en-us_ljspeech';
   
   return await synthesizeSpeechWithOpenTTSFlow({ textToSpeak, voice: voiceToUse });
}
