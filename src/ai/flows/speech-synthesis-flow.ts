
'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted or public OpenTTS server.
 * This flow connects to an OpenTTS-compatible endpoint to generate speech.
 */
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64';

// IMPORTANT: This is a public demo server. It is NOT for production use.
// It may be slow, unreliable, and data sent to it is not private.
// For production, replace this with the URL of your own deployed OpenTTS server.
const OPENTTS_SERVER_URL = "https://your-public-opentts-server-url.com/api/tts";

async function synthesizeSpeechWithOpenTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const { textToSpeak } = input;
  let { voiceProfileId } = input;

  const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

  // Simple language detection to choose an appropriate voice if not specified
  if (!voiceProfileId) {
    const containsHindi = /[\u0900-\u097F]/.test(sanitizedText) || /\b(hai|kya|mein|lekin|aur|par)\b/i.test(sanitizedText);
    voiceProfileId = containsHindi ? 'vits:hi-in-cmu-indic-book' : 'vits:en-in-cmu-indic-book'; // Default to Hindi Female or English Male
  }

  try {
    console.log(`[OpenTTS] Calling TTS server at ${OPENTTS_SERVER_URL} for voice: ${voiceProfileId}`);
    
    const response = await fetch(OPENTTS_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: sanitizedText,
            voice: voiceProfileId,
            ssml: false
        })
    });

    if (!response.ok) {
        let errorDetails = `Server responded with status: ${response.status} ${response.statusText}.`;
        try {
            const errorBody = await response.text();
            errorDetails += ` Response Body: ${errorBody.substring(0, 200)}`;
        } catch (e) {
            // Ignore if can't read body
        }
        throw new Error(errorDetails);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Base64.fromUint8Array(new Uint8Array(audioBuffer));
    const dataUri = `data:audio/wav;base64,${audioBase64}`;

    return {
      text: sanitizedText,
      audioDataUri: dataUri,
      voiceProfileId: voiceProfileId,
    };

  } catch (err: any) {
    console.error("❌ OpenTTS synthesis flow failed:", err);
    
    let errorMessage = `[TTS Connection Error]: Could not connect to the TTS server at ${OPENTTS_SERVER_URL}. Please ensure the server is running, publicly accessible, and the URL is configured correctly in 'src/ai/flows/speech-synthesis-flow.ts'. (Details: ${err.message})`;
     if (err.message?.includes("Failed to fetch")) {
        errorMessage = `[TTS Network Error]: Failed to fetch from the TTS server at ${OPENTTS_SERVER_URL}. This can be due to the server being offline, a network issue, or a CORS policy problem on the server. Please verify the server status and its CORS configuration.`;
    }

    return {
      text: sanitizedText,
      audioDataUri: `tts-flow-error:[${errorMessage}]`,
      errorMessage: errorMessage,
      voiceProfileId: voiceProfileId,
    };
  }
}

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
  return await synthesizeSpeechWithOpenTTS(input);
}
