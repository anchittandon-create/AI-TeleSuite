
'use server';
/**
 * @fileOverview Speech synthesis flow using the dedicated Google Cloud Text-to-Speech API.
 * This provides a more stable, production-ready alternative to the preview Gemini TTS model.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from 'dotenv';

config(); // Load environment variables

// Initialize the client once, reusing the instance.
// The client will automatically use the GOOGLE_APPLICATION_CREDENTIALS environment
// variable set in `genkit.ts` which points to `key.json`.
const ttsClient = new TextToSpeechClient();

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

    try {
      console.log(`[Cloud TTS] Requesting synthesis with voice: ${voiceToUse}`);

      const request = {
        input: { text: textToSpeak },
        voice: { languageCode: 'en-IN', name: voiceToUse },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      // Retry logic with exponential backoff for transient network or quota issues
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          [response] = await ttsClient.synthesizeSpeech(request);
          break; // Success, exit loop
        } catch (err: any) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw err; // Re-throw error after max attempts
          }
          const delay = Math.pow(2, attempts) * 100; // 200ms, 400ms
          console.warn(`[TTS] Attempt ${attempts} failed. Retrying in ${delay}ms...`, err.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }


      if (!response || !response.audioContent) {
        throw new Error('No audio content returned from the Text-to-Speech API after retries.');
      }

      const audioDataUri = `data:audio/mp3;base64,${Buffer.from(response.audioContent).toString('base64')}`;

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      console.error("❌ Google Cloud TTS synthesis flow failed:", err);
      let finalErrorMessage = `[TTS Service Error]: Could not generate audio.`;
      if (err.message?.includes("API key") || err.message?.includes("permission") || err.code === 7 || err.code === 16) {
          finalErrorMessage = "[TTS Auth Error]: The service failed to authenticate, likely due to an issue with the provided credentials. Details: " + err.message;
      } else if (err.message?.includes("quota")) {
          finalErrorMessage = "[TTS Quota Error]: You have exceeded the usage quota for the Text-to-Speech API. Please check your Google Cloud project billing and quota settings.";
      } else if (err.message?.includes("unsupported")) {
           finalErrorMessage = `[TTS Config Error]: The TTS service failed, possibly due to an unsupported configuration. Details: ${err.message}`;
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
