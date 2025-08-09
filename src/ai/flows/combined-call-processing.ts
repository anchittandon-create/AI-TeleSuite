
'use server';
/**
 * @fileOverview Orchestrates the entire call processing workflow: transcription and scoring.
 * This flow is designed to be resilient and provide status updates.
 */

import { z } from 'zod';
import { transcribeAudio, TranscriptionOutput } from './transcription-flow';
import { scoreCall, ScoreCallOutput } from './call-scoring';
import { Product } from '@/types';

export const CombinedCallProcessingInputSchema = z.object({
  audioDataUri: z.string(),
  product: z.enum(["ET", "TOI", "General"]),
  agentName: z.string().optional(),
});
export type CombinedCallProcessingInput = z.infer<typeof CombinedCallProcessingInputSchema>;

export const CombinedCallProcessingOutputSchema = z.object({
  status: z.enum(["Complete", "Failed"]),
  transcriptionOutput: z.custom<TranscriptionOutput>().optional(),
  scoreOutput: z.custom<ScoreCallOutput>().optional(),
  error: z.string().optional(),
});
export type CombinedCallProcessingOutput = z.infer<typeof CombinedCallProcessingOutputSchema>;


export async function processAndScoreCall(
  input: CombinedCallProcessingInput,
  updateStatus: (status: string) => void
): Promise<CombinedCallProcessingOutput> {
  try {
    // Step 1: Transcription
    updateStatus('Transcribing...');
    const transcriptionOutput = await transcribeAudio({ audioDataUri: input.audioDataUri });

    if (transcriptionOutput.accuracyAssessment === "Error" || transcriptionOutput.diarizedTranscript.includes("[Error")) {
      throw new Error(`Transcription failed: ${transcriptionOutput.diarizedTranscript}`);
    }

    // Step 2: Scoring
    updateStatus('Scoring...');
    const scoreOutput = await scoreCall({
      product: input.product,
      agentName: input.agentName,
      transcriptOverride: transcriptionOutput.diarizedTranscript,
    });
    
    if (scoreOutput.callCategorisation === "Error") {
      throw new Error(`Scoring failed: ${scoreOutput.summary}`);
    }

    updateStatus('Complete');
    return {
      status: "Complete",
      transcriptionOutput,
      scoreOutput,
    };

  } catch (error: any) {
    console.error("Error in combined call processing flow:", error);
    updateStatus('Failed');
    return {
      status: "Failed",
      error: error.message,
    };
  }
}
