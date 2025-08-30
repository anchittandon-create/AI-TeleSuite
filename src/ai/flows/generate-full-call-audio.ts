'use server';
/**
 * @fileOverview A flow to generate a single audio file from a conversation history.
 * It synthesizes speech for each AI turn and silences for user turns, then concatenates them.
 * This version uses the client-side TTS utility for generation.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { ConversationTurn } from '@/types';
import { GenerateFullCallAudioInputSchema, GenerateFullCallAudioOutputSchema } from '@/types';
import type { GenerateFullCallAudioInput, GenerateFullCallAudioOutput } from '@/types';


// This flow is now a placeholder as TTS is handled client-side.
// The logic is kept for future server-side enhancements if needed.
const generateFullCallAudioFlow = ai.defineFlow(
  {
    name: 'generateFullCallAudioFlow',
    inputSchema: GenerateFullCallAudioInputSchema,
    outputSchema: GenerateFullCallAudioOutputSchema,
  },
  async (input: GenerateFullCallAudioInput): Promise<GenerateFullCallAudioOutput> => {
    // Since TTS is client-side, this flow will just return a placeholder or error.
    // In a real server-side implementation, this would involve complex audio processing.
    const errorMessage = "Full call audio generation is now handled on the client-side and this server flow is deprecated. An audio URI should have been passed from the client.";
    console.warn(errorMessage);
    return {
        audioDataUri: "",
        errorMessage: errorMessage,
    };
  }
);


export async function generateFullCallAudio(
  input: GenerateFullCallAudioInput
): Promise<GenerateFullCallAudioOutput> {
  try {
    return await generateFullCallAudioFlow(input);
  } catch (e: any) {
    console.error("Catastrophic error in generateFullCallAudio flow:", e);
    return {
      audioDataUri: "",
      errorMessage: `Critical error in audio generation flow: ${e.message}`,
    };
  }
}
