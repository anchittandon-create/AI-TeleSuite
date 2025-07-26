
'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted or public Coqui TTS server.
 * This flow connects to a compatible endpoint to generate speech.
 */
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64';

// This URL must point to your publicly deployed Coqui TTS server.
// Example for a Render deployment: https://your-service-name.onrender.com
// The API endpoint for Coqui is typically /api/tts
const TTS_SERVER_URL = "https://ai-telesuite-tts-server.onrender.com/api/tts";

async function synthesizeWithCoquiTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const { textToSpeak, voiceProfileId } = input;

  // Sanitize and limit text length to avoid overly long requests
  const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

  // Default to a high-quality Indian English voice if none is specified.
  const speakerToUse = voiceProfileId || 'tts_models/en/ljspeech/vits';
  const languageId = speakerToUse.split('/')[1] || 'en'; // Infer language from voice ID

  try {
    
    console.log(`[TTS] Calling Coqui TTS server at ${TTS_SERVER_URL} for voice: ${speakerToUse}`);
    
    // Coqui TTS API payload structure.
    const response = await fetch(TTS_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: sanitizedText,
            speaker_id: speakerToUse, // Use 'speaker_id' which is common for Coqui models
            style_wav: "", // Often needed, can be empty
            language_id: languageId,
        })
    });

    if (!response.ok) {
        let errorDetails = `Server responded with status: ${response.status} ${response.statusText}.`;
        try {
            const errorBody = await response.text();
            // Slice to prevent overly long error messages in the UI
            errorDetails += ` Response Body (excerpt): ${errorBody.substring(0, 300)}`;
        } catch (e) {
            errorDetails += " Could not read error response body."
        }
        
        throw new Error(errorDetails);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Base64.fromUint8Array(new Uint8Array(audioBuffer));
    const dataUri = `data:audio/wav;base64,${audioBase64}`;

    return {
      text: sanitizedText,
      audioDataUri: dataUri,
      voiceProfileId: speakerToUse,
    };

  } catch (err: any) {
    console.error("❌ Coqui TTS synthesis flow failed:", err);
    
    let errorMessage = `[TTS Connection Error]: Could not connect to the TTS server at ${TTS_SERVER_URL}. Please ensure the server is running, publicly accessible, and the URL is configured correctly. (Details: ${err.message})`;
     if (err.message?.includes("fetch")) {
        errorMessage = `[TTS Network Error]: Failed to fetch from the TTS server at ${TTS_SERVER_URL}. This can be due to the server being offline, a network issue, or a CORS policy problem on the server. Please verify the server status and its CORS configuration.`;
    }

    return {
      text: sanitizedText,
      audioDataUri: `tts-flow-error:[${errorMessage}]`,
      errorMessage: errorMessage,
      voiceProfileId: speakerToUse,
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
  return await synthesizeWithCoquiTTS(input);
}
