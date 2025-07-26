
'use server';
/**
 * @fileOverview Speech synthesis flow that connects to a self-hosted OpenTTS server.
 * This flow is designed to work with a publicly accessible OpenTTS instance.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { encode } from 'js-base64';

// IMPORTANT: Replace this placeholder with the actual public URL of your deployed OpenTTS server.
// This server must be accessible from the internet for this cloud-based application to reach it.
// Example: 'https://your-tts-service-xyz.a.run.app/api/tts'
const OPENTTS_SERVER_URL = 'https://your-public-opentts-server-url.com/api/tts'; 

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
    
    // Sanitize text for the TTS engine.
    const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

    // Default to a common Indian English voice for OpenTTS if none is provided.
    // This voice ID must exist on your OpenTTS server. Example: 'vits:en-in-cmu-indic-book'
    const voiceToUse = voiceProfileId || 'vits:en-in-cmu-indic-book'; 

    try {
      if (OPENTTS_SERVER_URL.includes("your-public-opentts-server-url.com")) {
        throw new Error(`The OpenTTS server URL is still set to the default placeholder. Please update the 'OPENTTS_SERVER_URL' constant in 'src/ai/flows/speech-synthesis-flow.ts' with your actual public server address.`);
      }

      console.log(`[TTS Flow] Calling OpenTTS server at ${OPENTTS_SERVER_URL} for text: "${sanitizedText.substring(0, 50)}..." with voice ${voiceToUse}`);
      
      const response = await fetch(OPENTTS_SERVER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/wav'
        },
        body: JSON.stringify({
            text: sanitizedText,
            voice: voiceToUse,
            ssml: false,
        })
      });

      if (!response.ok) {
        throw new Error(`OpenTTS server responded with status ${response.status}: ${response.statusText}. Please check if the server is running and publicly accessible at the configured URL.`);
      }

      const audioBuffer = await response.arrayBuffer();
      const wavBase64 = encode(new Uint8Array(audioBuffer));
      const dataUri = `data:audio/wav;base64,${wavBase64}`;
      
      console.log(`[TTS Flow] Successfully received and encoded audio of size: ${dataUri.length} chars (base64)`);

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (err: any) {
      console.error("❌ OpenTTS synthesis flow failed:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      let errorMessage = `[TTS Connection Error]: Could not connect to the TTS server at ${OPENTTS_SERVER_URL}. Please ensure the server is running, publicly accessible, and the URL is configured correctly in 'src/ai/flows/speech-synthesis-flow.ts'. (Details: ${err.message || 'Unknown fetch error'})`;
      
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
