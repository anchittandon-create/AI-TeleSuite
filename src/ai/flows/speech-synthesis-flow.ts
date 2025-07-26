
'use server';
/**
 * @fileOverview Speech synthesis flow that uses the Google Cloud Text-to-Speech API
 * via the official Node.js client library. This approach correctly handles authentication
 * using the GOOGLE_APPLICATION_CREDENTIALS environment variable.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import textToSpeech from '@google-cloud/text-to-speech';

// Initialize the client. It will automatically use the credentials from the environment.
const ttsClient = new textToSpeech.TextToSpeechClient();

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
      textToSpeak = "I'm here to assist you. Could you please clarify your request?";
    }
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

    const request = {
      input: { text: sanitizedText },
      voice: {
        languageCode: 'en-IN',
        name: voiceProfileId || 'en-IN-Wavenet-D', // Use provided voice or default to a high-quality Indian voice
      },
      audioConfig: {
        audioEncoding: 'MP3' as const, // Use MP3 for broad browser compatibility
      },
    };

    try {
      console.log(`[TTS Flow] Calling Google Cloud TTS for text: "${sanitizedText.substring(0, 50)}..." with voice ${request.voice.name}`);
      
      const [response] = await ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned from Google TTS API.');
      }
      
      const audioBase64 = Buffer.from(response.audioContent).toString('base64');
      const dataUri = `data:audio/mp3;base64,${audioBase64}`;
      console.log(`[TTS Flow] Successfully received audio of size: ${audioBase64.length} chars (base64)`);

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: request.voice.name,
      };

    } catch (err: any) {
      console.error("❌ Google Cloud TTS synthesis flow failed:", err);
      let errorMessage = `TTS API Error: ${err.message || 'Unknown error'}.`;
      if (err.code === 7 || err.message?.includes('permission') || err.message?.includes('denied')) {
        errorMessage = "TTS Error: Permission Denied. Please ensure your GOOGLE_APPLICATION_CREDENTIALS (key.json) are correct, and the Text-to-Speech API is enabled with billing for your project.";
      }
      
      return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage: errorMessage,
        voiceProfileId: request.voice.name,
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
