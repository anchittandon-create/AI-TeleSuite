
'use server';
/**
 * @fileOverview Speech synthesis flow that now calls a local API endpoint
 * handled by the custom Next.js server.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { config } from 'dotenv';
// Removed 'headers' from next/headers as it's no longer needed for this approach.

config(); // Load environment variables

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutput,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    // Default to a standard WaveNet voice if no profile is provided.
    const voiceToUse = voiceProfileId || 'en-IN-Wavenet-D'; 
    
    // Use a fixed, reliable URL for the local development server.
    // This avoids the issue of dynamically resolving an incorrect host/protocol.
    const ttsUrl = 'http://localhost:9003/api/tts';

    try {
      console.log(`[TTS Flow] Sending request to integrated TTS endpoint at ${ttsUrl} for voice: ${voiceToUse}`);

      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSpeak,
          voice: voiceToUse,
        }),
        // When fetching from itself on the server, cache can be an issue
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[TTS Flow] TTS endpoint responded with status ${response.status}: ${errorBody}`);
        throw new Error(`The TTS service returned an error: ${response.statusText}. Details: ${errorBody}`);
      }

      const responseData = await response.json();
      
      if (!responseData.audioContent) {
        throw new Error('No audio content was returned from the TTS service.');
      }
      
      // The audio content is already Base64 encoded from the API route
      const audioDataUri = `data:audio/mp3;base64,${responseData.audioContent}`;

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      console.error("❌ TTS synthesis flow failed:", err);
      let finalErrorMessage = `[TTS Service Error]: Could not generate audio.`;
      if (err.message?.includes("ECONNREFUSED") || err.message?.toLowerCase().includes("fetch failed")) {
          finalErrorMessage = `[TTS Connection Error]: Could not connect to the internal TTS service at ${ttsUrl}. Please ensure the API route is accessible. (Details: ${err.message})`;
      } else if (err.message?.includes("TTS service returned an error")) {
           finalErrorMessage = `[TTS Server Error]: The integrated TTS service failed to process the request. Details: ${err.message}`;
      } else {
          finalErrorMessage += ` Last error: ${err.message}`;
      }
      
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${finalErrorMessage}]`,
        errorMessage: finalErrorMessage,
        voiceProfileId: voiceToUse,
      };
    }
  }
);


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const parseResult = SynthesizeSpeechInputSchema.safeParse(input);
  if (!parseResult.success) {
      const errorMessage = `Input validation failed for speech synthesis: ${parseResult.error.format()}`;
      console.error("❌ synthesizeSpeech wrapper caught Zod error:", errorMessage);
       return {
        text: input.textToSpeak || "Invalid input",
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage,
        voiceProfileId: input.voiceProfileId
      };
  }
  return await synthesizeSpeechFlow(input);
}
