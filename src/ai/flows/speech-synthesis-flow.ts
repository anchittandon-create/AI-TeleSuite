
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

const DEFAULT_VOICE_ID = 'en/vctk_low#p225'; // Default to a common Indian English male voice

async function synthesizeSpeechFlow(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    
    // Validate inputs before calling the AI
    if (!textToSpeak || textToSpeak.trim().length === 0) {
      const errorMsg = "Input validation failed: Text to speak cannot be empty.";
      console.error(errorMsg);
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${errorMsg}]`,
        errorMessage: errorMsg,
        voiceProfileId: voiceProfileId,
      };
    }
    
    // Use the provided voice ID or fall back to the default Indian English voice
    const voiceToUse = voiceProfileId || DEFAULT_VOICE_ID;
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
            throw new Error(`TTS server responded with status ${response.status}: ${await response.text()}. Is the self-hosted TTS server running at ${ttsUrl}?`);
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
        const errorMessage = `Self-Hosted TTS Generation FAILED. Error: ${error.message || 'Unknown error'}. Ensure the local TTS server is running and accessible at ${ttsUrl}, and the voice ID '${voiceToUse}' is valid.`;
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
    
    if (!validatedInput.textToSpeak || validatedInput.textToSpeak.trim() === "") {
        throw new Error("Text to speak cannot be empty.");
    }

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
