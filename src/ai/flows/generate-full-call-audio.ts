
"use server";
// This file is now deprecated and its logic is handled client-side in the dashboard.
// This is kept to prevent build errors but can be safely removed if no longer imported.

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ConversationTurn } from '@/types';

const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()),
    aiVoice: z.string().optional(),
    customerVoice: z.string().optional(),
});

const GenerateFullCallAudioOutputSchema = z.object({
    audioDataUri: z.string()
});

export const generateFullCallAudio = ai.defineFlow(
    {
        name: 'generateFullCallAudio',
        inputSchema: GenerateFullCallAudioInputSchema,
        outputSchema: GenerateFullCallAudioOutputSchema,
    },
    async (input) => {
        console.warn("generateFullCallAudio flow is deprecated. Audio stitching is now handled client-side.");
        // Return an empty URI as this flow is no longer responsible for audio generation.
        return { audioDataUri: "" };
    }
);
