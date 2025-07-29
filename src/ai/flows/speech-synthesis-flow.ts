
'use server';
/**
 * @fileOverview Speech synthesis flow that uses Genkit's native Gemini TTS model,
 * with a fallback to a self-hosted server to mitigate API quota issues.
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

// This function will try the self-hosted endpoint first.
const synthesizeSpeechViaSelfHosted = async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput | null> => {
  const { textToSpeak, voiceProfileId } = input;
  const voiceToUse = voiceProfileId || PRESET_VOICES[0].id;
  
  // The local server is now running on the same port as the Next.js app.
  const localTtsUrl = `http://localhost:${process.env.PORT || 9003}/api/tts`;

  try {
    const response = await fetch(localTtsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textToSpeak, voice: voiceToUse, ssml: false }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Self-hosted TTS server responded with ${response.status}. Error: ${errorBody}. Falling back to Genkit...`);
      return null; // Fallback to Genkit
    }

    const audioBuffer = await response.arrayBuffer();
    const audioDataUri = `data:audio/wav;base64,${Buffer.from(audioBuffer).toString('base64')}`;

    return {
      text: textToSpeak,
      audioDataUri,
      voiceProfileId: voiceToUse,
    };
  } catch (err: any) {
    console.warn(`Self-hosted TTS call failed: ${err.message}. This is expected if the local server isn't running. Falling back to Genkit...`);
    return null; // Fallback to Genkit on network error
  }
};


const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutput,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = voiceProfileId || PRESET_VOICES[0].id;

    // First, try the self-hosted endpoint
    const selfHostedResult = await synthesizeSpeechViaSelfHosted(input);
    if (selfHostedResult) {
      console.log(`[TTS Flow] Successfully synthesized speech via self-hosted server for voice: ${voiceToUse}`);
      return selfHostedResult;
    }

    // Fallback to Genkit's Gemini TTS if self-hosted fails
    try {
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
      console.error(`❌ TTS synthesis flow (Genkit fallback) failed:`, err);
      const finalErrorMessage = `[TTS Service Error]: Could not generate audio. ${err.message}`;
      
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
