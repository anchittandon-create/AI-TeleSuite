
'use server';
/**
 * @fileOverview Production-grade speech synthesis flow using Google Cloud TTS via Genkit.
 * This flow synthesizes text into a playable WAV audio Data URI with robust error handling.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { SynthesizeSpeechInputSchema } from '@/types';
import * as wavEncoder from 'wav-encoder';
import { Base64 } from 'js-base64';

// A map of user-friendly names to actual Google Cloud TTS voice model IDs
const IndianVoiceMap: Record<string, string> = {
  "Algenib": "en-IN-Standard-A", // Male
  "Achernar": "en-IN-Standard-B", // Female
  "en-IN-Wavenet-A": "en-IN-Wavenet-A", // Male (WaveNet)
  "en-IN-Wavenet-B": "en-IN-Wavenet-B", // Female (WaveNet)
  "en-IN-Wavenet-C": "en-IN-Wavenet-C", // Female (WaveNet)
  "en-IN-Wavenet-D": "en-IN-Wavenet-D", // Male (WaveNet)
};

const DEFAULT_VOICE_ID = "en-IN-Standard-B"; // Default to a standard female voice

async function generateAudioFlow(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  let { textToSpeak, voiceProfileId } = input;
  
  // 1. Validate and sanitize pitchText
  if (!textToSpeak || textToSpeak.trim().length < 5 || textToSpeak.toLowerCase().includes("undefined")) {
    console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
    textToSpeak = "I'm here to assist you. Could you please clarify your request?";
  }
  // Sanitize for TTS model compatibility
  const sanitizedText = textToSpeak.replace(/["&\n\r]/g, "'").slice(0, 4500);
  
  // Determine the voice model to use
  const voiceModelId = (voiceProfileId && IndianVoiceMap[voiceProfileId]) ? IndianVoiceMap[voiceProfileId] : DEFAULT_VOICE_ID;
  const ttsModelString = `google-tts:${voiceModelId}`;

  try {
    console.log(`🎤 Calling TTS with model: ${ttsModelString}`);
    
    // 2. Call the TTS model using Genkit
    const result = await ai.generate({
      model: ttsModelString as any, // Cast as any to allow dynamic model string
      prompt: sanitizedText,
    });
    
    // The googleAI plugin's TTS response already provides a playable data URI
    const audioDataUri = result.output?.media?.url;

    if (!audioDataUri || !audioDataUri.startsWith('data:audio')) {
      throw new Error(`No valid audio data URI received from TTS model. Response was: ${JSON.stringify(result.output)}`);
    }
    
    return {
        text: sanitizedText,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceProfileId, // Return the user-facing ID
    };

  } catch (err: any) {
    console.error(`❌ TTS generation failed for model ${ttsModelString}. Error:`, err);
    let detailedErrorMessage = `TTS generation failed: ${err.message}.`;
    if (err.message?.includes("403")) {
        detailedErrorMessage += " This is a 'Permission Denied' error. Please ensure your GOOGLE_APPLICATION_CREDENTIALS are set correctly in the .env file, point to a valid key.json, and the Text-to-Speech API is enabled with billing on your Google Cloud project.";
    } else if (err.message?.includes("Could not find model")) {
        detailedErrorMessage += ` The voice model '${voiceModelId}' might be invalid or unavailable.`;
    }
    
    return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${detailedErrorMessage}]`,
        errorMessage: detailedErrorMessage,
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
  return await generateAudioFlow(input);
}
