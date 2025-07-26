'use server';
/**
 * @fileOverview Production-grade speech synthesis flow using the free-tier Gemini TTS model.
 * This flow synthesizes text into a playable WAV audio Data URI with robust error handling.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { SynthesizeSpeechInputSchema } from '@/types';
import wav from 'wav';

// A map of user-friendly names to the voice names supported by the Gemini TTS model.
const IndianVoiceMap: Record<string, string> = {
  "Algenib": "Algenib", // Male
  "Achernar": "Achernar", // Female
  "en-IN-Wavenet-D": "Algenib", // Mapping old IDs to new ones
  "en-IN-Wavenet-C": "Achernar", // Mapping old IDs to new ones
};
const DEFAULT_VOICE_ID = "Algenib";


/**
 * Converts raw PCM audio data (as a Buffer) into a Base64 encoded WAV string.
 * @param pcmData The raw PCM audio buffer.
 * @param channels The number of audio channels.
 * @param rate The sample rate of the audio.
 * @param sampleWidth The width of each audio sample in bytes.
 * @returns A promise that resolves with the Base64 encoded WAV string.
 */
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

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));

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
    if (!textToSpeak || textToSpeak.trim().length < 5 || textToSpeak.toLowerCase().includes("undefined")) {
      console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
      textToSpeak = "I'm here to assist you. Could you please clarify your request?";
    }
    const sanitizedText = textToSpeak.replace(/["&\n\r]/g, "'").slice(0, 4500);

    const voiceName = (voiceProfileId && IndianVoiceMap[voiceProfileId]) ? IndianVoiceMap[voiceProfileId] : DEFAULT_VOICE_ID;
    
    console.log("🗣️ Generating audio for:", sanitizedText.substring(0, 50) + "...", "with voice:", voiceName);

    try {
      const { media } = await ai.generate({
        model: 'gemini-2.5-flash-preview-tts',
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
        prompt: sanitizedText,
      });

      if (!media || !media.url || !media.url.startsWith('data:audio/pcm;base64,')) {
        throw new Error('No valid PCM audio data returned from Gemini TTS API.');
      }
      
      const pcmBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      
      const base64Wav = await toWav(pcmBuffer);
      const dataUri = `data:audio/wav;base64,${base64Wav}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceProfileId,
      };

    } catch (err: any) {
      console.error("❌ TTS generation failed:", err);
      let detailedErrorMessage = `TTS generation failed: ${err.message}.`;
      if (String(err).includes("API_KEY_INVALID") || String(err).includes("403")) {
          detailedErrorMessage += " This may be a 'Permission Denied' or 'Invalid API Key' error. Please ensure your GEMINI_API_KEY (or GOOGLE_API_KEY) is set correctly in the .env file and has access to the Gemini API.";
      }
       return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${detailedErrorMessage}]`,
        errorMessage: detailedErrorMessage,
        voiceProfileId: voiceProfileId,
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
