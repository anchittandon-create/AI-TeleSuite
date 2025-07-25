'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted TTS engine (e.g., OpenTTS/Coqui TTS).
 * This flow synthesizes text into audible speech and returns a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { z } from 'zod';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { SynthesizeSpeechInputSchema } from '@/types';

const DEFAULT_VOICE_ID = 'en/vctk_low#p225'; // Default to a common Indian English male voice if provided one is invalid

async function synthesizeSpeechFlow(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    
    // Validate inputs before calling the AI
    if (!textToSpeak || textToSpeak.trim().length === 0 || textToSpeak.length > 5000) {
      const errorMsg = `Input validation failed: Text to speak must be between 1 and 5000 characters. Provided length: ${textToSpeak?.length || 0}.`;
      console.error(errorMsg);
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${errorMsg}]`,
        errorMessage: errorMsg,
        voiceProfileId: voiceProfileId,
      };
    }
    
    // Use the provided voice ID or fall back to the default Indian English voice
    // A simple list of "known good" voices for a standard OpenTTS/Coqui setup.
    const knownGoodVoices = [
        "en/vctk_low#p225", // Raj - Calm Indian Male
        "en/vctk_low#p228", // Ananya - Friendly Indian Female
        // Add other valid voice IDs from your TTS server here
    ];

    let voiceToUse = voiceProfileId || DEFAULT_VOICE_ID;
    if (voiceProfileId && !knownGoodVoices.includes(voiceProfileId) && !voiceProfileId.startsWith('uploaded:') && !voiceProfileId.startsWith('recorded:')) {
        console.warn(`Provided voiceProfileId "${voiceProfileId}" is not in the known good list. Falling back to default: ${DEFAULT_VOICE_ID}`);
        voiceToUse = DEFAULT_VOICE_ID;
    } else if (voiceProfileId && (voiceProfileId.startsWith('uploaded:') || voiceProfileId.startsWith('recorded:'))) {
        // For custom voices, map to a base speaker if cloning isn't implemented, or use a specific model if it is.
        // For now, we'll use the default as a base.
        console.log(`Custom voice sample detected (${voiceProfileId}). Using default voice model '${DEFAULT_VOICE_ID}' as the base for TTS.`);
        voiceToUse = DEFAULT_VOICE_ID;
    }
    

    const ttsUrl = "http://localhost:5500/api/tts";

    console.log(`🎤 Self-Hosted TTS Info: Attempting speech generation. Voice: ${voiceToUse}, Text (truncated): ${textToSpeak.substring(0, 50)}...`);

    try {
        const response = await fetch(ttsUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: textToSpeak,
                voice: voiceToUse,
                ssml: false,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`TTS server responded with status ${response.status}: ${errorBody}. Is the self-hosted TTS server running at ${ttsUrl} and is the voice '${voiceToUse}' installed?`);
        }

        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

        if (!audioDataUri || audioDataUri.length < 1000) {
          throw new Error('Generated WAV data URI is invalid or too short. Check TTS server output.');
        }
        
        console.log(`✅ Self-Hosted TTS Success: Generated playable WAV audio URI. Length: ${audioDataUri.length}`);
        
        return {
            text: textToSpeak,
            audioDataUri: audioDataUri,
            voiceProfileId: voiceToUse,
        };

    } catch (error: any) {
        const errorMessage = `Self-Hosted TTS Generation FAILED. Error: ${error.message || 'Unknown error'}. Ensure the local TTS server is running and accessible at ${ttsUrl}.`;
        console.error(`❌ ${errorMessage}`);
        return {
          text: textToSpeak,
          audioDataUri: `tts-flow-error:[${errorMessage}]`,
          errorMessage: errorMessage,
          voiceProfileId: voiceProfileId,
        };
    }
}


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    return await synthesizeSpeechFlow(validatedInput);
  } catch (e: any) {
    let errorMessage = `Failed to synthesize speech: ${e.message}`;
    const errorUri = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'})]: ${(input.textToSpeak || "No text provided").substring(0,50)}...`;

    if (e instanceof z.ZodError) {
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join('; ')}`;
    }
    
    console.error("❌ synthesizeSpeech wrapper caught error:", errorMessage);
    
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
