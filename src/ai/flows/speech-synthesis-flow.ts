'use server';
/**
 * @fileOverview Production-grade speech synthesis flow using Google Cloud TTS via Genkit.
 * This flow synthesizes text into a playable WAV audio Data URI.
 * - generateAudio - Generates speech from text.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import { SynthesizeSpeechInputSchema } from '@/types';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { Base64 } from "js-base64";
import { encode } from "wav-encoder";

const generateAudioFlow = ai.defineFlow(
  {
    name: "generateAudioFlow",
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    let { textToSpeak, voiceProfileId } = input;
    
    // 1. Guard clause for safety
    if (!textToSpeak || textToSpeak.trim().length === 0) {
      console.warn("⚠️ No text provided to TTS flow. Returning fallback message.");
      textToSpeak = "I'm here to assist you. Could you please tell me what you need help with?";
    }

    const voiceToUse = voiceProfileId || 'Algenib';

    try {
      // 2. Generate audio using Genkit + Gemini Flash TTS
      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceToUse },
                },
            },
        },
        prompt: textToSpeak,
      });

      if (!media || !media.url || !media.url.includes(',')) {
        throw new Error('TTS audio not returned from Gemini or was invalid.');
      }
      
      // 3. Convert raw PCM buffer to a WAV file
      const pcmBuffer = Buffer.from(
          media.url.substring(media.url.indexOf(',') + 1),
          'base64'
      );
      
      // The model returns raw PCM data, which we need to treat as Float32Array for wav-encoder
      const audioFloat32Array = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT);

      const wavData = await encode({
        sampleRate: 24000, // Gemini TTS sample rate
        channelData: [audioFloat32Array],
      });
      
      // 4. Encode WAV buffer to Base64 playable URI
      const wavBase64 = Base64.fromUint8Array(wavData);
      const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      const errorMessage = `TTS Generation Failed: ${err.message}.`;
      console.error("❌ generateAudioFlow Error:", errorMessage, err);
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
  return await generateAudioFlow(input);
}
