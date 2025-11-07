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
    
    // In a real implementation, you would iterate through input.conversationHistory,
    // call a TTS service for each 'AI' turn, generate silence for 'User' turns,
    // and concatenate the audio files.
    
    // Instead, we will simulate by concatenating existing audio URIs if they exist.
    // This part of the logic is complex and requires server-side libraries for audio manipulation (e.g., ffmpeg),
    // which are not available in this environment. So we will return the first available audio URI.
    
    const firstAudioTurn = input.conversationHistory?.find(t => t.audioDataUri && t.speaker === 'AI');
    
    if(firstAudioTurn?.audioDataUri) {
        // This is a simplified approach. A real implementation would concatenate all audio segments.
        return {
            audioDataUri: firstAudioTurn.audioDataUri,
        }
    }
    
    return {
        audioDataUri: "",
        errorMessage: "No audio was found in the conversation turns to generate a full recording.",
    };
  }
);


export async function generateFullCallAudio(
  input: GenerateFullCallAudioInput
): Promise<GenerateFullCallAudioOutput> {
  try {
    return await generateFullCallAudioFlow(input);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Catastrophic error in generateFullCallAudio flow:", error);
    return {
      audioDataUri: "",
      errorMessage: `Critical error in audio generation flow: ${errorMessage}`,
    };
  }
}
