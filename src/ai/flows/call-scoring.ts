
'use server';

/**
 * @fileOverview Call scoring analysis flow.
 * Genkit has been removed. This flow will return placeholder error messages.
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

// import {ai} from '@/ai/genkit'; // Genkit removed
import {z} from 'genkit';
// import { transcribeAudio } from './transcription-flow'; // transcribeAudio will also be disabled
// import type { TranscriptionOutput } from './transcription-flow';
import { PRODUCTS, Product, CALL_SCORE_CATEGORIES, CallScoreCategory } from '@/types';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  product: z.enum(PRODUCTS).describe("The product (ET or TOI) that the call is primarily about. This context is crucial for scoring."),
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
  overallScore: z.number().min(0).max(5).describe('The overall call score (0-5) based on all evaluated metrics. 0 for error/disabled.'), // Allow 0 for error
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES).describe("Overall category of the call performance (e.g., 'Very Good', 'Good', 'Average', 'Bad', 'Very Bad'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context, inferred tonality, and sentiment."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product, and overall sentiment observed."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product and agent conduct.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning their product handling, communication, or responses to user sentiment.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  console.warn("AI Call Scoring: Genkit has been removed. Returning placeholder error response.");
  const errorMessage = "Call Scoring feature is disabled as AI Service (Genkit) has been removed.";
  try {
      ScoreCallInputSchema.parse(input); // Basic validation
      return Promise.resolve({
          transcript: "[Transcription Disabled - Genkit Removed]",
          transcriptAccuracy: "N/A - Feature Disabled",
          overallScore: 0,
          callCategorisation: "Error",
          metricScores: [{ metric: "Feature Status", score: 1, feedback: errorMessage }],
          summary: errorMessage,
          strengths: ["AI Service Disabled"],
          areasForImprovement: ["AI Service Disabled"]
      });
  } catch (e) {
    const error = e as Error;
    console.error("Error in disabled scoreCall function (likely input validation):", error);
    const validationErrorMessage = `Input Error: ${error.message}. ${errorMessage}`;
    return Promise.resolve({
          transcript: `[Error - ${error.message}]`,
          transcriptAccuracy: "Error",
          overallScore: 0,
          callCategorisation: "Error",
          metricScores: [{ metric: "Error", score: 1, feedback: validationErrorMessage }],
          summary: validationErrorMessage,
          strengths: ["Input Error"],
          areasForImprovement: ["Check input parameters"]
      });
  }
}

// const ScoreCallPromptInputSchema = z.object({ // Genkit removed
//   // ...
// });

// const ScoreCallPromptOutputSchema = ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true }); // Genkit removed


// const scoreCallPrompt = ai.definePrompt({ // Genkit removed
//   name: 'scoreCallPrompt',
//   // ...
// });

// const scoreCallFlow = ai.defineFlow( // Genkit removed
//   {
//     name: 'scoreCallFlow',
//     inputSchema: ScoreCallInputSchema,
//     outputSchema: ScoreCallOutputSchema,
//   },
//   async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
//     // ... original logic ...
//     throw new Error("scoreCallFlow called but Genkit is removed.");
//   }
// );
