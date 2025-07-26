
'use server';
/**
 * @fileOverview Speech synthesis flow that uses the Gemini TTS model and encodes the output to a playable WAV format.
 * This approach is robust and avoids potential browser inconsistencies with other audio formats.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import wav from 'wav';

// Helper function to convert raw PCM audio buffer to a Base64 encoded WAV string
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

    const chunks: Buffer[] = [];
    writer.on('data', (chunk) => {
      chunks.push(chunk);
    });
    writer.on('end', () => {
      resolve(Buffer.concat(chunks).toString('base64'));
    });
    writer.on('error', reject);

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
      textToSpeak = "I'm sorry, I encountered an issue and cannot respond right now.";
    }
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

    const voiceToUse = voiceProfileId || 'Algenib'; // Algenib is a high-quality Indian English voice
    
    try {
      console.log(`[TTS Flow] Calling Gemini TTS model for text: "${sanitizedText.substring(0, 50)}..." with voice ${voiceToUse}`);
      
      const { media } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-preview-tts',
        config: {
          responseModalities: ['AUDIO', 'TEXT'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceToUse },
            },
          },
        },
        prompt: sanitizedText,
      });

      if (!media || !media.url) {
        throw new Error('No audio media returned from Gemini TTS API.');
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
      console.error("❌ Gemini TTS synthesis flow failed:", err);
      let errorMessage = `TTS API Error: ${err.message || 'Unknown error'}. This often indicates an authentication or API configuration issue.`;
      if (err.code === 7 || err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('API key not valid') || err.message?.toLowerCase().includes('precondition')) {
        errorMessage = "TTS Error: Permission Denied or Invalid API Key/Service Account. Please ensure your key.json (service account) is correct and the Generative Language API is enabled with billing for your project.";
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
