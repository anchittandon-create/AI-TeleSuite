
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
import { GOOGLE_PRESET_VOICES } from '@/hooks/use-voice-samples';


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
    const voiceToUse = voiceProfileId || GOOGLE_PRESET_VOICES[0].id;
    
    // The previous implementation using a custom API route was unreliable.
    // This new implementation uses Genkit's native TTS model directly.
    // The `ai` object in `genkit.ts` is now configured with the necessary service account
    // credentials, making this call properly authenticated.
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

      if (media?.url) {
        // The Gemini TTS model returns raw PCM data. We need to convert it to a WAV
        // file format to make it playable in the browser.
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
    } catch (genkitErr: any) {
      console.error(`❌ Genkit TTS flow failed:`, genkitErr);
      const detailedErrorMessage = `[TTS Service Error]: Could not generate audio. ${genkitErr.message}`;
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
