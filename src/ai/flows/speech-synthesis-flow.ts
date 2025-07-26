
'use server';
/**
 * @fileOverview Speech synthesis flow that calls a local, CORS-enabled mock TTS server.
 * This approach solves browser security (CORS) issues by centralizing the TTS call
 * through a local server proxy, which is a standard pattern for such problems.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64'; // Using js-base64 for robust encoding

const MOCK_TTS_SERVER_URL = 'http://localhost:5500/api/tts';

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

    const requestBody = {
      text: sanitizedText,
      voice: voiceProfileId || "coqui-tts-female", // Pass voice profile to server
      ssml: false,
    };

    try {
      console.log(`[TTS Flow] Calling local TTS server at ${MOCK_TTS_SERVER_URL} for text: "${sanitizedText.substring(0, 50)}..."`);
      
      const response = await fetch(MOCK_TTS_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Local TTS server returned an error: ${response.status} ${response.statusText}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      console.log(`[TTS Flow] Successfully received audio buffer of size: ${audioBuffer.byteLength}`);

      // Encode the ArrayBuffer to Base64 using a reliable library
      const audioBase64 = Base64.fromUint8Array(new Uint8Array(audioBuffer));
      const dataUri = `data:audio/wav;base64,${audioBase64}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceProfileId,
      };

    } catch (err: any) {
      console.error("❌ Local TTS synthesis flow failed:", err);
      let errorMessage = `TTS Server Error: ${err.message || 'Unknown error'}. Is the mock TTS server running ('npm run tts-server') and reachable at ${MOCK_TTS_SERVER_URL}?`;
      if (err.message?.includes('fetch failed')) {
        errorMessage = "TTS Error: Could not connect to the local TTS server. Please ensure it's running (`npm run tts-server`) and that there are no network issues preventing connection from the Next.js server to localhost:5500.";
      }
      
      return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage: errorMessage,
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
