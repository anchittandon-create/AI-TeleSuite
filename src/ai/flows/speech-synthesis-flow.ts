
'use server';
/**
 * @fileOverview Production-grade speech synthesis flow using a configurable TTS endpoint.
 * This flow synthesizes text into a playable WAV audio Data URI.
 * It includes robust error handling and input sanitization.
 */

import { z } from 'zod';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { SynthesizeSpeechInputSchema } from '@/types';

// Use an environment variable for the TTS endpoint for easy switching
const TTS_API_ENDPOINT = process.env.TTS_API_ENDPOINT || "http://localhost:5500/api/tts";

/**
 * A robust, production-grade sanitization function for TTS input.
 */
const sanitizeTextForTTS = (text: string | undefined | null): string => {
    const SAFE_FALLBACK = "I'm here to help you today. How may I assist you?";
    const MIN_LENGTH = 1;
    const MAX_LENGTH = 4500;

    if (!text || text.trim().length < MIN_LENGTH || text.toLowerCase().includes("undefined")) {
        console.warn("⚠️ TTS flow received invalid text. Using fallback message.", {originalText: text});
        return SAFE_FALLBACK;
    }

    let sanitizedText = text.replace(/[\r\n"&*]/g, ' ').replace(/\s+/g, ' ').trim();

    if (sanitizedText.length > MAX_LENGTH) {
        sanitizedText = sanitizedText.substring(0, MAX_LENGTH);
    }
    
    if (sanitizedText.length < MIN_LENGTH) {
        return SAFE_FALLBACK;
    }
    return sanitizedText;
};


async function generateAudioFlow(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    const sanitizedText = sanitizeTextForTTS(textToSpeak);
    const voiceToUse = voiceProfileId || 'en/vctk_low#p225'; // Default voice for the request body

    console.log(`Speech Synthesis Flow: Attempting to call TTS endpoint: ${TTS_API_ENDPOINT}`);

    try {
        const response = await fetch(TTS_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: sanitizedText,
                voice: voiceToUse,
                ssml: false,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`TTS service failed with status ${response.status}: ${errorBody}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const base64Wav = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${base64Wav}`;

        return {
            text: sanitizedText,
            audioDataUri: audioDataUri,
            voiceProfileId: voiceToUse,
        };

    } catch (err: any) {
        const errorMessage = `TTS Generation Failed: ${err.message}. Is the TTS server running at ${TTS_API_ENDPOINT}?`;
        console.error("❌ synthesizeSpeech flow Error:", errorMessage, err);
        return {
            text: sanitizedText,
            audioDataUri: `tts-flow-error:[${errorMessage}]`,
            errorMessage,
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
  return await generateAudioFlow(input);
}
