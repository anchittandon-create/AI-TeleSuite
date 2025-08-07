
'use server';

/**
 * @fileOverview Orchestrates the asynchronous, multi-step process of call processing.
 * This flow handles transcription and scoring, updating the activity log at each step.
 * This ensures the UI remains responsive and can track the job's progress.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { scoreCall } from './call-scoring';
import type { ScoreCallInput } from '@/types';
import { updateActivityInLocalStorage } from '@/lib/activity-log-server';

const processCallInputSchema = z.object({
    activityId: z.string(),
    product: z.string(),
    agentName: z.string().optional(),
    audioDataUri: z.string().optional(),
    transcriptOverride: z.string().optional(),
});

export const processCall = ai.defineFlow(
  {
    name: 'processCallOrchestrator',
    inputSchema: processCallInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const { activityId, product, agentName, audioDataUri, transcriptOverride } = input;
    
    try {
        // Step 1: Update status to Transcribing (if applicable)
        if (audioDataUri) {
            await updateActivityInLocalStorage(activityId, { status: 'Transcribing' });
        } else {
             await updateActivityInLocalStorage(activityId, { status: 'Scoring' });
        }
        
        // Step 2: Call the main scoreCall function which handles both transcription and scoring
        const scoreInput: ScoreCallInput = {
            product: product as any, // Cast as we know it's valid from the form
            agentName,
            audioDataUri,
            transcriptOverride,
        };

        const scoreOutput = await scoreCall(scoreInput);

        // Step 3: Update status to Complete or Failed based on result
        if (scoreOutput.callCategorisation === 'Error') {
             await updateActivityInLocalStorage(activityId, {
                status: 'Failed',
                error: scoreOutput.summary,
                scoreOutput: scoreOutput,
            });
        } else {
            await updateActivityInLocalStorage(activityId, {
                status: 'Complete',
                scoreOutput: scoreOutput,
            });
        }

    } catch (e: any) {
        console.error(`Critical error in processCallOrchestrator for activity ${activityId}:`, e);
        // Final fallback to ensure the job is marked as failed
        await updateActivityInLocalStorage(activityId, {
            status: 'Failed',
            error: `An unexpected orchestrator error occurred: ${e.message}`,
        });
    }
  }
);

    