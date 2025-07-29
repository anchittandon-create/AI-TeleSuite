
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
import wav from 'wav';
import { PRESET_VOICES } from '@/hooks/use-voice-samples';


async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
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
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = voiceProfileId || PRESET_VOICES[0].id;

    try {
      // We are now directly using the Genkit Gemini TTS model as the primary method.
      // The self-hosted server approach has been removed to simplify the architecture.
      console.log(`[TTS Flow] Using Genkit Gemini TTS model for voice: ${voiceToUse}`);

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

      if (media?.url) {
        const pcmData = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
        const wavBase64 = await toWav(pcmData);
        const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

        return {
          text: textToSpeak,
          audioDataUri: audioDataUri,
          voiceProfileId: voiceToUse,
        };
      } else {
        throw new Error('No media content was returned from the Genkit Gemini TTS model.');
      }
    } catch (err: any) {
      console.error(`❌ TTS synthesis flow failed:`, err);
      // Create a more informative error message to be returned in the data URI
      let detailedErrorMessage = `[TTS Service Error]: Could not generate audio via Genkit. Details: ${err.message}`;
      
      // Check for common issues like quota errors and add user-friendly advice.
      if (err.message && err.message.includes('429')) {
          detailedErrorMessage += " This is likely due to exceeding API request limits. Please check your plan and billing details.";
      }

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
