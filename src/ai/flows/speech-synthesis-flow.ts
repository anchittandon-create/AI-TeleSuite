'use server';
/**
 * @fileOverview Speech synthesis flow that connects to the Gemini 2.5 Flash Preview TTS model.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import wav from 'wav';

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000, // Gemini TTS default sample rate
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
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>()
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    let { textToSpeak, voiceProfileId } = input;
    
    if (!textToSpeak || textToSpeak.trim().length < 2) {
      console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
      textToSpeak = "I am sorry, I encountered an issue and cannot respond right now.";
    }
    
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);
    const voiceToUse = voiceProfileId || 'Algenib'; 

    try {
      console.log(`[TTS Flow] Calling Gemini TTS for text: "${sanitizedText.substring(0, 50)}..." with voice ${voiceToUse}`);
      
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
        prompt: sanitizedText,
      });

      if (!media || !media.url) {
        throw new Error('Gemini TTS model returned no media content.');
      }
      
      const audioBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      
      const wavBase64 = await toWav(audioBuffer);
      const dataUri = `data:audio/wav;base64,${wavBase64}`;
      
      console.log(`[TTS Flow] Successfully received and encoded audio of size: ${dataUri.length} chars (base64)`);

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      console.error("❌ Gemini TTS synthesis flow failed:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      let errorMessage = `[TTS API Error: ${err.message || 'Unknown error'}. This often indicates an authentication or API configuration issue.]`;

      if (err.message?.includes('429')) {
        errorMessage = `[TTS API Error]: You have exceeded your current quota for the TTS model. Please check your Google Cloud project's plan and billing details.`;
      } else if (err.message?.toLowerCase().includes("permission denied") || err.message?.toLowerCase().includes("api key not valid")) {
        errorMessage = `[TTS API Error]: Permission Denied or Invalid API Key/Service Account. Please ensure your key.json (service account) is correct, valid, and has the 'AI Platform User' role in Google Cloud IAM.`;
      }
      
      return {
        text: sanitizedText,
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
