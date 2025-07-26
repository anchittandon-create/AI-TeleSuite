
'use server';
/**
 * @fileOverview Production-grade speech synthesis flow using Google Cloud TTS.
 * This flow synthesizes text into a playable MP3 audio Data URI with robust error handling.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { SynthesizeSpeechInputSchema } from '@/types';
import textToSpeech from '@google-cloud/text-to-speech';

// Initialize the TTS client. It will automatically use the credentials
// from the GOOGLE_APPLICATION_CREDENTIALS environment variable.
const client = new textToSpeech.TextToSpeechClient();

const IndianVoiceMap: Record<string, string> = {
  "Algenib": "en-IN-Wavenet-D", // Male
  "Achernar": "en-IN-Wavenet-C", // Female
  "en-IN-Standard-A": "en-IN-Standard-A", // Male
  "en-IN-Standard-B": "en-IN-Standard-B", // Female
  "en-IN-Wavenet-A": "en-IN-Wavenet-A", // Male (WaveNet)
  "en-IN-Wavenet-B": "en-IN-Wavenet-B", // Female (WaveNet)
};
const DEFAULT_VOICE_ID = "en-IN-Wavenet-D";


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

    const request = {
      input: { text: sanitizedText },
      voice: {
        languageCode: 'en-IN',
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const
      }
    };
    
    console.log("🗣️ Generating audio for:", sanitizedText, "with voice:", voiceName);

    try {
      const [response] = await client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned from Google TTS API.');
      }
      
      const base64Audio = (response.audioContent as Buffer).toString('base64');
      const dataUri = `data:audio/mp3;base64,${base64Audio}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceProfileId,
      };

    } catch (err: any) {
      console.error("❌ TTS generation failed:", err);
      let detailedErrorMessage = `TTS generation failed: ${err.message}.`;
      if (String(err).includes("403")) {
          detailedErrorMessage += " This is a 'Permission Denied' error. Please ensure your GOOGLE_APPLICATION_CREDENTIALS are set correctly in the .env file, point to a valid key.json, and the Text-to-Speech API is enabled with billing on your Google Cloud project.";
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
