
'use server';
/**
 * @fileOverview Speech synthesis flow that uses a self-contained API route as its primary
 * TTS engine. This architecture is robust and avoids external dependencies or local server requirements.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { GOOGLE_PRESET_VOICES } from '@/hooks/use-voice-samples';


const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    // Use the provided voice ID or a default standard voice.
    const voiceToUse = voiceProfileId || GOOGLE_PRESET_VOICES[0].id;
    
    // Determine the correct base URL for the API route.
    // In a deployed Vercel environment, it can be called relative to the server origin.
    // Locally, we need the full URL.
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'http://localhost:9003';

    const apiUrl = `${baseUrl}/api/tts`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voice: voiceToUse }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
         throw new Error(data.error || `TTS API route returned an error: ${response.status} ${response.statusText}`);
      }

      return {
        text: textToSpeak,
        audioDataUri: data.audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (apiRouteError: any) {
      console.error(`❌ Speech synthesis failed. Could not connect to or get a valid response from the internal TTS API route at ${apiUrl}. Error:`, apiRouteError);
      
      const detailedErrorMessage = `[TTS Service Error]: Could not generate audio. Please check server logs for the /api/tts route. Error: ${apiRouteError.message}`;
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:${detailedErrorMessage}`,
        errorMessage: detailedErrorMessage,
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
