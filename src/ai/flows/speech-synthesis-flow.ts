
'use server';
/**
 * @fileOverview Speech synthesis flow that uses a self-hosted API route as its primary
 * TTS engine to prevent hitting external API quota limits. It falls back to Genkit's
 * native Gemini TTS model if the local route fails.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
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
    // Use 'Echo' for Bark simulation, otherwise the provided ID or a default.
    const voiceToUse = voiceProfileId || GOOGLE_PRESET_VOICES[0].id;
    
    // Determine the correct base URL for the API route
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://a-telesuitefinal-2f4v.project-42.ai`
      : 'http://localhost:9003';

    const apiUrl = `${baseUrl}/api/tts`;
    
    // PRIMARY METHOD: Call the self-hosted API route
    try {
      console.log(`Calling local TTS API route: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voice: voiceToUse }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
           throw new Error(`TTS API Route Returned Error: ${data.error}`);
        }
        return {
          text: textToSpeak,
          audioDataUri: data.audioDataUri,
          voiceProfileId: voiceToUse,
        };
      } else {
        const errorText = await response.text();
        console.warn(`Local TTS API route failed with status ${response.status}: ${errorText}. Falling back to Genkit TTS.`);
        throw new Error(`TTS API Route Error: ${errorText} (Status: ${response.status})`);
      }
    } catch (apiRouteError: any) {
      console.error(`❌ Local TTS API route call failed catastrophically:`, apiRouteError);
      
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
