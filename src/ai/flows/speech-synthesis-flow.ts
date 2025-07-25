'use server';
/**
 * @fileOverview Speech synthesis flow using Google Cloud TTS via Genkit.
 * This flow synthesizes text into audible speech and returns a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { SynthesizeSpeechInputSchema } from '@/types';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import wav from 'wav';

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: "synthesizeSpeechFlow",
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    
    // Default to a standard Indian English voice if none is provided
    const voiceToUse = voiceProfileId || 'Algenib';

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

      if (!media) {
        throw new Error('AI returned no media content for TTS.');
      }
      
      const audioBuffer = Buffer.from(
          media.url.substring(media.url.indexOf(',') + 1),
          'base64'
      );
      
      const wavBase64 = await toWav(audioBuffer);
      const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      const errorMessage = `TTS Generation Failed: ${err.message}. Please check server logs and ensure Google Cloud TTS API is enabled and configured.`;
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
