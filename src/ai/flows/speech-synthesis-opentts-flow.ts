
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
    // This flow's logic is now primarily executed on the client,
    // but we keep the flow definition for structural consistency.
    // The actual fetch and processing happens in the page component.
    // This function now effectively serves as a placeholder for the logic
    // that has been moved to the client.
    
    // In a real-world scenario with a server-to-server call, the logic would be here.
    // Since we are doing client-to-localhost, this flow is a passthrough.
    
    console.log("SynthesizeSpeechWithOpenTTSFlow invoked. In a client-side implementation, the actual fetch is handled on the page.");

    // Return a placeholder or an error, as the client should handle the call.
    return {
        text: textToSpeak,
        audioDataUri: `placeholder-for-client-synthesis`,
        voiceProfileId: voice,
        errorMessage: "This flow should not be called directly from the server in a client-to-localhost architecture. The logic is on the page."
    };
  }
);


export async function synthesizeSpeechWithOpenTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
   const { textToSpeak, voiceProfileId } = input;
   const voiceToUse = voiceProfileId || 'en-us_ljspeech';
   const openTtsUrl = 'http://localhost:5500/api/tts';
   
   try {
     const response = await fetch(`${openTtsUrl}?voice=${encodeURIComponent(voiceToUse)}&text=${encodeURIComponent(textToSpeak)}`, {
       method: 'GET', // OpenTTS often uses GET for simple requests
     });

     if (!response.ok) {
       throw new Error(`OpenTTS server responded with status: ${response.status} ${response.statusText}`);
     }

     const audioBuffer = await response.arrayBuffer();
     const audioBase64 = arrayBufferToBase64(audioBuffer);
     
     return {
       text: textToSpeak,
       audioDataUri: `data:audio/wav;base64,${audioBase64}`,
       voiceProfileId: voiceToUse,
     };

   } catch (error: any) {
     console.error("Error synthesizing speech with OpenTTS (client-side):", error);
     const errorMessage = `[OpenTTS Service Error]: Could not generate audio. Please ensure your local OpenTTS server is running and accessible at ${openTtsUrl}. Error: ${error.message}`;
     return {
       text: textToSpeak,
       audioDataUri: `tts-flow-error:${errorMessage}`,
       errorMessage: errorMessage,
       voiceProfileId: voiceToUse
     };
   }
}
