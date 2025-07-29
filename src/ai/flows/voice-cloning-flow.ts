
'use server';
/**
 * @fileOverview AI-powered voice cloning (simulation).
 * This flow takes a voice sample and text, then generates speech
 * that attempts to mimic the characteristics of the sample.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

const CloneVoiceInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(1000, "Text to speak is limited to 1000 characters for cloning."),
  voiceSampleDataUri: z.string().describe("An audio file of a voice sample, as a data URI that must include a MIME type and use Base64 encoding."),
});
export type CloneVoiceInput = z.infer<typeof CloneVoiceInputSchema>;

const CloneVoiceOutputSchema = z.object({
  audioDataUri: z.string().describe("A Data URI representing the synthesized audio in WAV format ('data:audio/wav;base64,...')."),
});
export type CloneVoiceOutput = z.infer<typeof CloneVoiceOutputSchema>;

async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));
    writer.write(pcmData);
    writer.end();
  });
}

const cloneVoiceFlow = ai.defineFlow(
  {
    name: 'cloneVoiceFlow',
    inputSchema: CloneVoiceInputSchema,
    outputSchema: CloneVoiceOutputSchema,
  },
  async (input) => {
    try {
      const { media } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest',
        prompt: [
          {
            text: `You are a voice cloning AI. Analyze the provided voice sample. Your task is to generate audio for the given text that mimics the key characteristics (pitch, tone, pacing) of the sample voice.

Text to synthesize: "${input.textToSpeak}"`,
          },
          { media: { url: input.voiceSampleDataUri } },
        ],
        config: {
          responseModalities: ['AUDIO'], // Request audio output
          temperature: 0.3,
        },
      });

      if (!media || !media.url.startsWith('data:audio/pcm;base64,')) {
        throw new Error('The AI model did not return valid PCM audio data.');
      }
      
      const pcmData = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
      const wavBase64 = await toWav(pcmData);

      return {
        audioDataUri: `data:audio/wav;base64,${wavBase64}`,
      };

    } catch (error: any) {
        console.error("Error in cloneVoiceFlow:", error);
        throw new Error(`Voice cloning failed: ${error.message}`);
    }
  }
);

export async function cloneVoice(input: CloneVoiceInput): Promise<CloneVoiceOutput> {
  return await cloneVoiceFlow(input);
}
