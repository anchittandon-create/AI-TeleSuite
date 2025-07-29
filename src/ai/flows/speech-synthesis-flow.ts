
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
    const ttsApiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://[YOUR_PRODUCTION_URL]/api/tts' // Replace with your actual production URL
      : 'http://localhost:9003/api/tts';

    try {
      // First, try the self-hosted Next.js API route
      const response = await fetch(ttsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voice: voiceToUse }),
      });

      if (response.ok) {
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        // The endpoint returns a WAV file directly
        const audioDataUri = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;
        return {
          text: textToSpeak,
          audioDataUri: audioDataUri,
          voiceProfileId: voiceToUse,
        };
      } else {
        const errorText = await response.text();
        console.warn(`Local TTS API failed (Status: ${response.status}). Error: ${errorText}. Falling back to Genkit TTS.`);
        throw new Error(`Local TTS server failed: ${errorText}`);
      }
    } catch (err: any) {
      console.error(`Local TTS fetch failed, falling back to Genkit Gemini TTS. Error:`, err);
      // Fallback to Genkit Gemini TTS model if the local route fails
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
        console.error(`❌ Genkit TTS fallback also failed:`, genkitErr);
        const detailedErrorMessage = `[TTS Service Error]: Both local and cloud TTS failed. Details: ${genkitErr.message}`;
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
