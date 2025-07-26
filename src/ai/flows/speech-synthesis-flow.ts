
'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted or public Coqui TTS server.
 * This flow connects to a compatible endpoint to generate speech.
 */
import { z } from 'zod';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { Base64 } from 'js-base64';

// This URL now points to your deployed Coqui TTS server on Render.
const TTS_SERVER_URL = "https://ai-telesuite-tts-server.onrender.com/api/tts";

async function synthesizeWithExternalTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const { textToSpeak, voiceProfileId } = input;

  const sanitizedText = textToSpeak.replace(/["&]/g, "'").slice(0, 4500);

  // Default to a high-quality Indian English voice if none is specified.
  const voiceToUse = voiceProfileId || 'tts_models/en/ljspeech/vits';

  try {
    if (TTS_SERVER_URL.includes("your-deployed-coqui-tts-server.com")) {
      throw new Error("The TTS server URL is still set to the default placeholder. Please update the 'TTS_SERVER_URL' constant in 'src/ai/flows/speech-synthesis-flow.ts' with your actual public server address.");
    }
    
    console.log(`[TTS] Calling external TTS server at ${TTS_SERVER_URL} for voice: ${voiceToUse}`);
    
    // Coqui TTS API payload structure.
    const response = await fetch(TTS_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: sanitizedText,
            model_name: voiceToUse,
            // Other parameters like speaker_id, style_wav, etc., can be added if needed for multi-speaker/style models
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
      voiceProfileId: voiceToUse,
    };

  } catch (err: any) {
    console.error("❌ External TTS synthesis flow failed:", err);
    
    let errorMessage = `[TTS Connection Error]: Could not connect to the TTS server at ${TTS_SERVER_URL}. Please ensure the server is running, publicly accessible, and the URL is configured correctly. (Details: ${err.message})`;
     if (err.message?.includes("Failed to fetch")) {
        errorMessage = `[TTS Network Error]: Failed to fetch from the TTS server at ${TTS_SERVER_URL}. This can be due to the server being offline, a network issue, or a CORS policy problem on the server. Please verify the server status and its CORS configuration.`;
    }

    return {
      text: sanitizedText,
      audioDataUri: `tts-flow-error:[${errorMessage}]`,
      errorMessage: errorMessage,
      voiceProfileId: voiceToUse,
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
