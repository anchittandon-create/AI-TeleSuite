'use server';

/**
 * @fileOverview Call scoring analysis flow.
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { transcribeAudio } from './transcription-flow';
import type { TranscriptionOutput } from './transcription-flow';
import { PRODUCTS, Product, CALL_SCORE_CATEGORIES, CallScoreCategory } from '@/types';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  product: z.enum(PRODUCTS).optional().describe("The product (ET or TOI) that the call is primarily about. If omitted, a general sales call analysis is performed."),
  agentName: z.string().optional().describe('The name of the agent.'),
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

const MetricScoreSchema = z.object({
  metric: z.string().describe("Name of the performance metric (e.g., 'Opening & Rapport Building', 'Needs Discovery', 'Product Presentation', 'Objection Handling', 'Closing Effectiveness', 'Clarity & Communication', 'Agent's Tone & Professionalism', 'User's Perceived Sentiment', 'Product Knowledge')."),
  score: z.number().min(1).max(5).describe("Score for this specific metric (1-5)."),
  feedback: z.string().describe("Specific feedback, observations, or comments related to this metric, especially concerning the selected product and inferred tonality/sentiment.")
});

const ScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of the call conversation (potentially diarized with speaker labels like "Agent:" or "User:"). Transcript will be in Roman script, possibly containing transliterated Hindi words.'),
  transcriptAccuracy: z.string().describe("The AI's qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium')."),
  overallScore: z.number().min(0).max(5).describe('The overall call score (0-5) based on all evaluated metrics.'),
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES).describe("Overall category of the call performance (e.g., 'Very Good', 'Good', 'Average', 'Bad', 'Very Bad'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context, inferred tonality, and sentiment. Ensure 'Agent's Tone & Professionalism' and 'User's Perceived Sentiment' are included as distinct metrics with scores and feedback."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product, and overall sentiment observed."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product and agent conduct.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning their product handling, communication, or responses to user sentiment.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

// Schema for the output of the scoring AI call (doesn't include transcript fields as they are input)
const ScoreCallGenerationOutputSchema = ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true });

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput, transcriptOverride?: string): Promise<ScoreCallOutput> => {
    let transcriptResult: TranscriptionOutput;

    if (transcriptOverride) {
      transcriptResult = {
        diarizedTranscript: transcriptOverride,
        accuracyAssessment: "Provided (from text simulation)"
      };
    } else {
      try {
        transcriptResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
        
        // This check is now inside the try block, so it only runs on success.
        if (!transcriptResult || transcriptResult.accuracyAssessment === "Error" ||
            (transcriptResult.diarizedTranscript && (
                transcriptResult.diarizedTranscript.startsWith("[Transcription Error") ||
                transcriptResult.diarizedTranscript.startsWith("[Transcription API Error") ||
                transcriptResult.diarizedTranscript.startsWith("[Transcription Timeout") ||
                transcriptResult.diarizedTranscript.startsWith("[Transcription Blocked") ||
                transcriptResult.diarizedTranscript.startsWith("[Critical Transcription System Error") ||
                transcriptResult.diarizedTranscript.startsWith("[AI returned an empty transcript")
            ))) {
          console.warn("scoreCallFlow: Transcription step reported an error. Content:", transcriptResult?.diarizedTranscript);
          return {
            transcript: transcriptResult?.diarizedTranscript || "[System Error: Transcription result was malformed or empty]",
            transcriptAccuracy: transcriptResult?.accuracyAssessment || "Error",
            overallScore: 0,
            callCategorisation: "Error",
            metricScores: [{ metric: "Transcription Process", score: 1, feedback: `Transcription failed. Details: ${transcriptResult?.diarizedTranscript.substring(0, 250) || 'Unknown transcription error'}` }],
            summary: "Call scoring aborted because the audio transcription step failed or returned an error.",
            strengths: [],
            areasForImprovement: ["Address the transcription issue (e.g., check audio file size/format, API key validity, or wait if it was a timeout) and try again."]
          };
        }
      } catch (transcriptionServiceError) {
        // This catch block now correctly returns immediately, preventing further execution.
        const err = transcriptionServiceError as Error;
        console.error("Critical error calling transcribeAudio service from scoreCallFlow:", err);
        return {
          transcript: `[System Error: Transcription service call failed unexpectedly: ${err.message}]`,
          transcriptAccuracy: "Error",
          overallScore: 0,
          callCategorisation: "Error",
          metricScores: [{ metric: "Transcription System", score: 1, feedback: `System error during transcription initiation: ${err.message}` }],
          summary: "Call scoring aborted due to a system-level transcription failure.",
          strengths: [],
          areasForImprovement: ["Check system logs and audio file integrity. Try again if the issue seems temporary."]
        };
      }
    }

    // This part of the code is now only reachable if transcription was successful.
    try {
      const productContext = input.product && input.product !== "General"
        ? `The call is regarding the product '${input.product}'. The 'Product Knowledge' and 'Product Presentation' metrics should be evaluated based on this specific product.`
        : "The call is a general sales call. The 'Product Knowledge' and 'Product Presentation' metrics should be evaluated based on general sales principles and how well the agent presents whatever product or service is being discussed, without needing specific pre-loaded knowledge of 'ET' or 'TOI'.";

      const scoringPromptText = `You are an expert call quality analyst and sales leader. Your task is to objectively and consistently score a sales call.
${productContext}
${input.agentName ? `The agent's name is ${input.agentName}.` : ''}

Transcript:
${transcriptResult.diarizedTranscript}

Based *strictly* on the transcript, evaluate the call across these key metrics:
- Opening & Rapport Building
- Needs Discovery
- Product Presentation
- Objection Handling
- Closing Effectiveness
- Clarity & Communication
- Agent's Tone & Professionalism
- User's Perceived Sentiment
- Product Knowledge (if a specific product is mentioned)

Provide an overall score (1-5, where 1 is poor and 5 is excellent), a categorization (Very Good, Good, Average, Bad, Very Bad), scores and detailed feedback for each metric.
The feedback for each metric should be specific and reference parts of the transcript if possible.
Also, provide a concise summary of the call, 2-3 key strengths observed, and 2-3 specific, actionable areas for improvement.
Be as objective as possible in your scoring.
Your output must be structured JSON conforming to the schema.
`;

      const { output: scoringOutput } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest',
        prompt: scoringPromptText,
        output: { schema: ScoreCallGenerationOutputSchema },
        config: { temperature: 0.2 }
      });

      if (!scoringOutput) {
        throw new Error("AI failed to generate scoring details. The response from the scoring model was empty.");
      }

      const finalOutput: ScoreCallOutput = {
        ...scoringOutput,
        transcript: transcriptResult.diarizedTranscript,
        transcriptAccuracy: transcriptResult.accuracyAssessment,
      };
      return finalOutput;

    } catch (err) {
      const error = err as Error;
      // Enhanced logging
      console.error("Error in scoreCallFlow (AI scoring part):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      return {
        transcript: transcriptResult.diarizedTranscript,
        transcriptAccuracy: transcriptResult.accuracyAssessment,
        overallScore: 0,
        callCategorisation: "Error",
        metricScores: [{ metric: "AI Scoring Model", score: 1, feedback: `The AI scoring model failed to process the transcript. Error: ${error.message}. Ensure the transcript is valid and the scoring model is accessible.` }],
        summary: `Failed to score call because the AI scoring model encountered an issue: ${error.message}`,
        strengths: [],
        areasForImprovement: ["AI service for scoring might be unavailable, encountered an issue with the transcript, or the API key may have issues with the scoring model. Check server logs."]
      };
    }
  }
);

export async function scoreCall(input: ScoreCallInput, transcriptOverride?: string): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input, transcriptOverride);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling scoreCallFlow from exported function:", error);
    const errorOutput: ScoreCallOutput = {
      transcript: "[System Error during scoring process execution]",
      transcriptAccuracy: "Unknown",
      overallScore: 0,
      callCategorisation: "Error",
      metricScores: [{ metric: "System", score: 1, feedback: `Critical system error in scoring flow: ${error.message}. Check server logs.` }],
      summary: `Call scoring failed due to a critical system error: ${error.message}`,
      strengths: [],
      areasForImprovement: ["Contact support or check server logs for critical system errors."]
    };
    return errorOutput;
  }
}
