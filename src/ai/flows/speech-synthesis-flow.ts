'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted TTS engine (e.g., OpenTTS/Coqui TTS).
 * This flow synthesizes text into audible speech and returns a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema } from '@/types';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: "synthesizeSpeechFlow",
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const ttsUrl = "http://localhost:5500/api/tts";
    
    // Default to a standard Indian English voice if none is provided or if it's a conceptual one
    const voiceToUse = voiceProfileId && !voiceProfileId.startsWith('uploaded:') && !voiceProfileId.startsWith('recorded:')
      ? voiceProfileId 
      : 'en/vctk_low#p225'; // A common Indian English male voice in Coqui/OpenTTS

    if (!textToSpeak || textToSpeak.trim().length === 0) {
      const errorMessage = "Input text is empty. Cannot generate speech.";
      console.error(`synthesizeSpeechFlow: ${errorMessage}`);
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage: errorMessage,
        voiceProfileId: voiceToUse
      };
    }

    try {
      const response = await fetch(ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          voice: voiceToUse,
          ssml: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS server responded with status ${response.status}: ${errText}. Is the server running at ${ttsUrl} and is the voice '${voiceToUse}' installed?`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

      if (!audioDataUri || audioDataUri.length < 1000) {
        throw new Error('Generated WAV data URI is invalid or too short. Check TTS server output.');
      }
      
      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };
    } catch (err: any) {
      const errorMessage = `TTS Generation Failed: ${err.message}. Please check server logs and ensure the self-hosted TTS engine is running correctly.`;
      console.error("❌ synthesizeSpeechFlow Error:", errorMessage);
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage,
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
