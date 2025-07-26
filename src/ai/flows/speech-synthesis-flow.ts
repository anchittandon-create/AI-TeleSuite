
'use server';
/**
 * @fileOverview Speech synthesis flow that connects to a self-hosted TTS engine.
 * This flow makes a POST request to a local server endpoint, which is expected
 * to be running a service like Coqui TTS or OpenTTS. This approach avoids
 * cloud API rate limits and costs.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64';


const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>()
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    let { textToSpeak, voiceProfileId } = input;
    
    // Fallback for empty text
    if (!textToSpeak || textToSpeak.trim().length < 2) {
      console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
      textToSpeak = "I am sorry, I encountered an issue and cannot respond right now.";
    }
    
    // Sanitize text to avoid issues with special characters in JSON payload
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);
    const voiceToUse = voiceProfileId || 'ljspeech/vits--en_US'; // A common default voice for Coqui/OpenTTS

    const ttsUrl = 'http://localhost:5500/api/tts';

    try {
      console.log(`[TTS Flow] Calling self-hosted TTS at ${ttsUrl} for text: "${sanitizedText.substring(0, 50)}..." with voice ${voiceToUse}`);
      
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sanitizedText,
          voice: voiceToUse,
          ssml: false
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`TTS service not found at ${ttsUrl}. Ensure your local TTS server is running and accessible.`);
        }
        throw new Error(`TTS server returned an error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const wavBase64 = Base64.fromUint8Array(new Uint8Array(audioBuffer));
      const dataUri = `data:audio/wav;base64,${wavBase64}`;
      
      console.log(`[TTS Flow] Successfully received and encoded audio of size: ${dataUri.length} chars (base64)`);

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      console.error("❌ Self-hosted TTS synthesis flow failed:", err);
      let errorMessage = `Local TTS Server Error: ${err.message || 'Unknown error'}.`;
      
      if (err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed')) {
        errorMessage = `Could not connect to the local TTS server at ${ttsUrl}. Please ensure your self-hosted TTS engine (like Coqui TTS or OpenTTS) is running and accessible at this address.`;
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
