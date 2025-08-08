
'use server';

/**
 * @fileOverview Orchestrates the asynchronous, multi-step process of call processing.
 * This flow handles transcription and scoring, updating the activity log at each step.
 * This ensures the UI remains responsive and can track the job's progress.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { scoreCall } from './call-scoring';
import { transcribeAudio } from './transcription-flow';
import type { ScoreCallInput } from '@/types';
// This flow does not interact with localStorage directly. It's a server-side orchestrator.
// The pattern demonstrated here is that it would update a central DB (like Firestore).
// In this app's implementation, the client polls localStorage for updates logged by other client actions.
// The `updateActivityInLocalStorage` is a placeholder for that DB interaction.
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
    // This flow's primary purpose is to orchestrate and update state elsewhere.
    // It returns the final ScoreCallOutput, which the client can use to update its state.
    outputSchema: z.custom<import('@/types').ScoreCallOutput>(),
  },
  async (input) => {
    const { activityId, product, agentName, audioDataUri, transcriptOverride } = input;
    let finalScoreOutput: import('@/types').ScoreCallOutput | null = null;
    
    try {
        let transcript = transcriptOverride;
        let transcriptAccuracy = "Provided as Text";

        // Step 1: Transcription (if applicable)
        if (audioDataUri) {
            await updateActivityInLocalStorage(activityId, { status: 'Transcribing' });
            const transcriptionResult = await transcribeAudio({ audioDataUri });
            if (transcriptionResult.accuracyAssessment === "Error" || transcriptionResult.diarizedTranscript.includes("[Error")) {
                throw new Error(`Transcription failed: ${transcriptionResult.diarizedTranscript}`);
            }
            transcript = transcriptionResult.diarizedTranscript;
            transcriptAccuracy = transcriptionResult.accuracyAssessment;
        }

        if (!transcript) {
            throw new Error("No transcript available to score.");
        }

        // Step 2: Scoring
        await updateActivityInLocalStorage(activityId, { status: 'Scoring' });
        const scoreInput: ScoreCallInput = {
            product: product as any, // Cast as we know it's valid from the form
            agentName,
            transcriptOverride: transcript,
        };

        const scoreOutput = await scoreCall(scoreInput);

        // Step 3: Final Update
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
        
        finalScoreOutput = scoreOutput;
        return finalScoreOutput;

    } catch (e: any) {
        console.error(`Critical error in processCallOrchestrator for activity ${activityId}:`, e);
        const errorMessage = `An unexpected orchestrator error occurred: ${e.message}`;
        await updateActivityInLocalStorage(activityId, {
            status: 'Failed',
            error: errorMessage,
        });
        
        // Return a structured error object that conforms to the output schema.
        // This is crucial so the calling client doesn't receive an unhandled exception.
        return {
            transcript: transcriptOverride || `[System Error during orchestration. Raw Error: ${e.message}]`,
            transcriptAccuracy: "System Error",
            overallScore: 0,
            callCategorisation: "Error",
            summary: errorMessage,
            strengths: ["N/A due to system error"],
            areasForImprovement: [`Investigate and resolve the orchestrator error: ${e.message.substring(0, 100)}...`],
            redFlags: [`System-level orchestrator error occurred: ${e.message.substring(0,100)}...`],
            metricScores: [{ metric: 'System Error', score: 1, feedback: errorMessage }]
        };
    }
  }
);

  