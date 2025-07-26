
'use server';
/**
 * @fileOverview Speech synthesis flow that uses the Gemini 2.5 Flash Preview TTS model.
 * This is a cloud-native solution that does not require any self-hosted servers.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';


/**
 * Converts raw PCM audio data from the Gemini TTS API into a Base64 encoded WAV string.
 * @param pcmData The raw audio buffer.
 * @returns A promise that resolves with the Base64 encoded WAV data.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000, // Gemini TTS outputs at 24000 Hz
  sampleWidth = 2 // 16-bit audio
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
    
    if (!textToSpeak || textToSpeak.trim().length < 2) {
      console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
      textToSpeak = "I am sorry, I encountered an issue and cannot respond right now.";
    }
    
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);
    const voiceToUse = voiceProfileId || 'Algenib'; // Default to a premium male voice

    try {
      console.log(`[TTS Flow] Calling Gemini 2.5 TTS for text: "${sanitizedText.substring(0, 50)}..." with voice ${voiceToUse}`);
      
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
        throw new Error('TTS API did not return any media content.');
      }
      
      // The Gemini TTS API returns raw PCM audio data in a data URI. We need to convert it to WAV.
      const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
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
      
      let errorMessage = `[TTS API Error]: ${err.message || 'Unknown API error'}`;
      if (err.message && (err.message.includes("429") || err.message.toLowerCase().includes("quota"))) {
          errorMessage = "[TTS Quota Error]: You have exceeded your current quota for the Gemini TTS API. Please check your plan and billing details in your Google Cloud project to continue using this feature.";
      } else if (err.message && (err.message.includes("403") || err.message.toLowerCase().includes("permission denied"))) {
          errorMessage = "[TTS Authentication Error]: The request was denied. Please ensure your API key and service account (`key.json`) are correctly configured and have the 'Vertex AI User' or 'Generative Language User' role in your Google Cloud project.";
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
