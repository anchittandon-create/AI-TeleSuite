
'use server';
/**
 * @fileOverview Speech synthesis flow that now calls a local TTS server.
 * This decouples the main app from direct TTS client authentication.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { config } from 'dotenv';
import { Base64 } from 'js-base64';


config(); // Load environment variables

const ttsServerUrl = 'http://localhost:5500/api/tts';

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutput,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = voiceProfileId || 'en-IN-Wavenet-D';

    try {
      console.log(`[TTS Flow] Sending request to local TTS server at ${ttsServerUrl} for voice: ${voiceToUse}`);

      const response = await fetch(ttsServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSpeak,
          voice: voiceToUse,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Local TTS server responded with status ${response.status}: ${errorBody}`);
      }

      const responseData = await response.json();
      
      if (!responseData.audioContent) {
        throw new Error('No audio content returned from the local TTS server.');
      }
      
      const audioDataUri = `data:audio/mp3;base64,${responseData.audioContent}`;

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      console.error("❌ TTS synthesis flow failed:", err);
      let finalErrorMessage = `[TTS Service Error]: Could not generate audio.`;
      if (err.message?.includes("ECONNREFUSED")) {
          finalErrorMessage = "[TTS Connection Error]: Could not connect to the local TTS server. Please ensure the TTS server is running. (Details: " + err.message + ")";
      } else if (err.message?.includes("TTS server responded")) {
           finalErrorMessage = `[TTS Server Error]: The local TTS server failed to process the request. Details: ${err.message}`;
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
