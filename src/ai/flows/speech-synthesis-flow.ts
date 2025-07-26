'use server';
/**
 * @fileOverview Speech synthesis flow using Google's Gemini TTS model via Genkit.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import wav from 'wav';

// Helper function to convert the raw PCM audio buffer from Gemini into a proper WAV format.
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

    const bufs: Buffer[] = [];
    writer.on('error', reject);
    writer.on('data', (chunk) => {
      bufs.push(chunk);
    });
    writer.on('end', () => {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutputSchema,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = voiceProfileId || 'Algenib'; // Default to a premium male voice

    try {
      console.log(`[TTS] Calling Gemini TTS model with voice: ${voiceToUse}`);
      
      const { media } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-preview-tts',
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

      if (!media || !media.url) {
        throw new Error('No media returned from the Gemini TTS model.');
      }
      
      // The Gemini TTS model returns raw PCM data in a base64 data URI.
      // We need to convert this to a proper WAV format to be playable in browsers.
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
      console.error("❌ Gemini TTS synthesis flow failed:", err);
      let errorMessage = `[TTS Service Error]: Could not generate audio. Details: ${err.message}`;
      if (err.message?.includes("API key")) {
        errorMessage = "[TTS Auth Error]: The provided API key is invalid or lacks permissions for the Text-to-Speech API. Please check your Google Cloud project settings and API key validity.";
      }
      
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage: errorMessage,
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
