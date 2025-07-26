
'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted or public OpenTTS/Coqui TTS server.
 * This flow connects to a compatible endpoint to generate speech.
 */
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64';

// IMPORTANT: This is a placeholder URL.
// For this feature to work, you must deploy your own Coqui TTS or OpenTTS server
// to a public cloud service (like Render, Railway, or Google Cloud Run) and
// replace the placeholder URL below with your actual server address.
const TTS_SERVER_URL = "https://your-deployed-coqui-tts-server.com/api/tts";

async function synthesizeWithExternalTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const { textToSpeak } = input;
  let { voiceProfileId } = input;

  const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

  // Default to a high-quality Indian English voice if none is specified.
  if (!voiceProfileId) {
    voiceProfileId = 'tts_models/en/ljspeech/vits'; // A common high-quality Coqui voice
  }

  try {
    if (TTS_SERVER_URL.includes("your-deployed-coqui-tts-server.com")) {
      throw new Error("The TTS server URL is still set to the default placeholder. Please update the 'TTS_SERVER_URL' constant in 'src/ai/flows/speech-synthesis-flow.ts' with your actual public server address.");
    }
    
    console.log(`[TTS] Calling external TTS server at ${TTS_SERVER_URL} for voice: ${voiceProfileId}`);
    
    // Coqui TTS and OpenTTS use a slightly different API payload structure.
    // This example uses a common structure. Adjust if your server requires a different format.
    const response = await fetch(TTS_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: sanitizedText,
            speaker_id: '', // Often used for multi-speaker models
            style_wav: '', // For voice cloning
            language_id: '', // For multi-language models
            voice: voiceProfileId, // For OpenTTS compatibility
            model_name: voiceProfileId, // For Coqui compatibility
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
    console.error("❌ External TTS synthesis flow failed:", err);
    
    let errorMessage = `[TTS Connection Error]: Could not connect to the TTS server at ${TTS_SERVER_URL}. Please ensure the server is running, publicly accessible, and the URL is configured correctly in 'src/ai/flows/speech-synthesis-flow.ts'. (Details: ${err.message})`;
     if (err.message?.includes("Failed to fetch")) {
        errorMessage = `[TTS Network Error]: Failed to fetch from the TTS server at ${TTS_SERVER_URL}. This can be due to the server being offline, a network issue, or a CORS policy problem on the server. Please verify the server status and its CORS configuration.`;
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
  return await synthesizeWithExternalTTS(input);
}
