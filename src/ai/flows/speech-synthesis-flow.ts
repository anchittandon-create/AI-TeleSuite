
'use server';
/**
 * @fileOverview Speech synthesis flow using the official Google Cloud Text-to-Speech library.
 * This is the robust, production-grade implementation for generating real audio.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import textToSpeech from '@google-cloud/text-to-speech';

// This client will automatically use the GOOGLE_APPLICATION_CREDENTIALS from your .env file
const client = new textToSpeech.TextToSpeechClient();

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

      const request = {
        input: { text: sanitizedText },
        voice: {
          languageCode: 'en-IN', // Set to Indian English
          name: voiceProfileId || 'en-IN-Wavenet-D' // Use provided voice or default to a high-quality Indian voice
        },
        audioConfig: {
          audioEncoding: 'MP3' as const // Use MP3 for good quality and web compatibility
        }
      };

      const [response] = await client.synthesizeSpeech(request);

      if (!response.audioContent || !(response.audioContent instanceof Uint8Array)) {
        throw new Error('No valid audio content returned from Google TTS API.');
      }
      
      console.log(`[TTS] Successfully received audio content of size: ${response.audioContent.length} bytes.`);

      const base64Audio = Buffer.from(response.audioContent).toString('base64');
      const dataUri = `data:audio/mp3;base64,${base64Audio}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceProfileId || 'en-IN-Wavenet-D',
      };

    } catch (err: any) {
      console.error("❌ Google TTS generation flow failed:", err);
      // Construct a specific error message
      let errorMessage = `TTS API Error: ${err.message || 'Unknown error'}.`;
       if (err.code === 7) { // Permission Denied
            errorMessage = "TTS Error: Permission Denied. Please check that your GOOGLE_APPLICATION_CREDENTIALS in .env point to a valid key.json file with the 'Text-to-Speech API' enabled and billing configured for your project.";
        } else if (err.code === 5) { // Not Found
            errorMessage = `TTS Error: Voice '${voiceProfileId}' not found or invalid. Please use a valid voice ID.`
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
