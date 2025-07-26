
'use server';
/**
 * @fileOverview Speech synthesis flow using the official Google Cloud Text-to-Speech client
 * for maximum reliability and control. This flow uses service account authentication.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { stream } from 'xlsx';

// This client will automatically use the GOOGLE_APPLICATION_CREDENTIALS from your .env file
const ttsClient = new TextToSpeechClient();

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
    
    // Default to a high-quality Indian English voice if not provided or invalid
    const voiceName = voiceProfileId && voiceProfileId.startsWith('en-IN') ? voiceProfileId : 'en-IN-Wavenet-D';

    const request = {
      input: { text: sanitizedText },
      voice: {
        languageCode: 'en-IN',
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3' as const // Use MP3 for broad browser compatibility
      }
    };

    try {
      console.log(`[TTS] Requesting audio for text: "${sanitizedText.substring(0, 50)}..." with voice: ${voiceName}`);

      const [response] = await ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned from Google TTS API.');
      }
      
      console.log(`[TTS] Successfully received MP3 audio content.`);
      
      const audioBase64 = response.audioContent.toString('base64');
      const dataUri = `data:audio/mp3;base64,${audioBase64}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceName,
      };

    } catch (err: any) {
      console.error("❌ Google TTS synthesis flow failed:", err);
      let errorMessage = `TTS API Error: ${err.message || 'Unknown error'}.`;
      if (err.code === 7 || err.message?.includes('permission') || err.message?.includes('denied')) {
        errorMessage = "TTS Error: Permission Denied. Please ensure your GOOGLE_APPLICATION_CREDENTIALS are set correctly and the service account has 'roles/cloudtranslate.serviceAgent' or 'roles/editor' permissions for the project.";
      }
      
      return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage: errorMessage,
        voiceProfileId: voiceName,
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
