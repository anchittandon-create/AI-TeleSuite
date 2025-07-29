
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
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL || 'localhost:9003'}` 
      : 'http://localhost:9003';

    const apiUrl = `${baseUrl}/api/tts`;
    
    // PRIMARY METHOD: Call the self-hosted API route
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voice: voiceToUse }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          text: textToSpeak,
          audioDataUri: data.audioDataUri,
          voiceProfileId: voiceToUse,
        };
      } else {
        const errorText = await response.text();
        console.warn(`Local TTS API route failed with status ${response.status}: ${errorText}. Falling back to Genkit TTS.`);
        // Fallback to Genkit TTS will happen in the catch block
        throw new Error(`TTS API Route Error: ${errorText} (Status: ${response.status})`);
      }
    } catch (apiRouteError: any) {
      console.error(`❌ Local TTS API route call failed catastrophically:`, apiRouteError);
      
      // FALLBACK METHOD: Use Genkit's native Gemini TTS model directly
      // This might be subject to stricter rate limits but provides a backup.
      try {
        console.log("Attempting fallback to Genkit's native Gemini TTS model...");
        const { media } = await ai.generate({
          model: googleAI.model('gemini-1.5-flash-latest'), // This might need adjustment based on available models
          config: {
              // This is a workaround as native TTS config might differ.
              // We're essentially asking a powerful model to generate audio, which may not be its primary function.
              // A more direct TTS model call would be `googleai.model('text-to-speech-model')` if available/configured.
              responseMimeType: "audio/wav", 
          },
          prompt: `Synthesize the following text into speech with a voice similar to '${voiceToUse}': ${textToSpeak}`,
        });

        if (media?.url) {
          return {
            text: textToSpeak,
            audioDataUri: media.url, // Assuming it returns a data URI
            voiceProfileId: voiceToUse,
          };
        } else {
          throw new Error('No media content was returned from the Genkit Gemini TTS model.');
        }
      } catch (genkitErr: any) {
        console.error(`❌ Genkit TTS fallback also failed:`, genkitErr);
        const detailedErrorMessage = `[TTS Service Error]: Could not generate audio. Primary Error: ${apiRouteError.message}. Fallback Error: ${genkitErr.message}`;
        return {
          text: textToSpeak,
          audioDataUri: `tts-flow-error:${detailedErrorMessage}`,
          errorMessage: detailedErrorMessage,
          voiceProfileId: voiceToUse,
        };
      }
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
