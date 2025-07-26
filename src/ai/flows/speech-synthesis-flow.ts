
'use server';
/**
 * @fileOverview Speech synthesis flow using the Genkit AI Gemini TTS model.
 * This implementation generates audio by encoding raw PCM data into a playable WAV format.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000, // Gemini TTS outputs at 24kHz
  sampleWidth = 2
): Promise<string> {
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
    outputSchema: z.custom<SynthesizeSpeechOutput>()
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    let { textToSpeak, voiceProfileId } = input;
    
    // 1. Validate and sanitize text
    if (!textToSpeak || textToSpeak.trim().length < 2 || textToSpeak.toLowerCase().includes("undefined")) {
      console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
      textToSpeak = "I'm here to assist you. Could you please clarify your request?";
    }
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

    try {
      console.log(`[TTS] Requesting audio for text: "${sanitizedText.substring(0, 50)}..." with voice: ${voiceProfileId}`);

      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceProfileId || 'Algenib' }, // Default to Algenib if not provided
                },
            },
        },
        prompt: sanitizedText,
      });

      if (!media || !media.url || !media.url.startsWith('data:audio/pcm;base64,')) {
        throw new Error('No valid PCM audio content returned from Gemini TTS API.');
      }
      
      console.log(`[TTS] Successfully received PCM audio content.`);
      
      const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1),'base64');
      const wavBase64 = await toWav(audioBuffer);
      const dataUri = `data:audio/wav;base64,${wavBase64}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceProfileId || 'Algenib',
      };

    } catch (err: any) {
      console.error("❌ Gemini TTS generation flow failed:", err);
      let errorMessage = `TTS API Error: ${err.message || 'Unknown error'}.`;
       if (err.message?.includes('API key')) {
            errorMessage = "TTS Error: Invalid or missing GEMINI_API_KEY. Please check your .env file.";
        }
      
      return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage: errorMessage,
        voiceProfileId: input.voiceProfileId,
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
