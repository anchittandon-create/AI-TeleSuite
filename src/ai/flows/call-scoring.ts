
'use server';

/**
 * @fileOverview Call scoring analysis flow.
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { transcribeAudio } from './transcription-flow';
import type { TranscriptionOutput } from './transcription-flow';
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
  overallScore: z.number().min(0).max(5).describe('The overall call score (0-5) based on all evaluated metrics.'),
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES).describe("Overall category of the call performance (e.g., 'Very Good', 'Good', 'Average', 'Bad', 'Very Bad'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context, inferred tonality, and sentiment. Ensure 'Agent's Tone & Professionalism' and 'User's Perceived Sentiment' are included as distinct metrics with scores and feedback."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product, and overall sentiment observed."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product and agent conduct.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning their product handling, communication, or responses to user sentiment.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;


// Schema for the input to the scoring prompt (after transcription)
const ScoreCallPromptInputSchema = z.object({
  transcript: z.string().describe("The full transcript of the call."),
  product: z.enum(PRODUCTS).describe("The product context for scoring."),
  agentName: z.string().optional().describe('The name of the agent, if provided.'),
});

// Schema for the output of the scoring prompt (doesn't include transcript fields as they are input)
const ScoreCallPromptOutputSchema = ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true });


const scoreCallPrompt = ai.definePrompt({
  name: 'scoreCallPrompt',
  input: {schema: ScoreCallPromptInputSchema},
  output: {schema: ScoreCallPromptOutputSchema},
  prompt: `You are an expert call quality analyst. Analyze the provided call transcript for a sales call regarding '{{{product}}}'.
{{#if agentName}}The agent's name is {{{agentName}}}.{{/if}}

Transcript:
{{{transcript}}}

Based on the transcript and product context, evaluate the call across these metrics:
- Opening & Rapport Building
- Needs Discovery
- Product Presentation (relevance to {{{product}}})
- Objection Handling
- Closing Effectiveness
- Clarity & Communication
- Agent's Tone & Professionalism (Provide a distinct score and feedback for this)
- User's Perceived Sentiment (Provide a distinct score and feedback for this)
- Product Knowledge (specific to {{{product}}})

Provide an overall score (1-5), a categorization (Very Good, Good, Average, Bad, Very Bad), scores and feedback for each metric (ensuring 'Agent's Tone & Professionalism' and 'User's Perceived Sentiment' are explicitly included with their own scores and feedback), a summary, strengths, and areas for improvement.
`,
  model: 'googleai/gemini-2.0-flash'
});

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    let transcriptResult: TranscriptionOutput;
    try {
      transcriptResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
    } catch (transcriptionError) {
      const err = transcriptionError as Error;
      console.error("Error during transcription in scoreCallFlow:", err);
      const errorOutput: ScoreCallOutput = {
        transcript: `[Transcription Failed: ${err.message}]`,
        transcriptAccuracy: "Error",
        overallScore: 0,
        callCategorisation: "Error",
        metricScores: [{ metric: "Transcription", score: 1, feedback: `Transcription failed: ${err.message}. Call cannot be scored.` }],
        summary: "Call scoring aborted due to transcription failure.",
        strengths: [],
        areasForImprovement: ["Ensure audio quality and try again."]
      };
      return errorOutput;
    }

    try {
      const promptInput: z.infer<typeof ScoreCallPromptInputSchema> = {
        transcript: transcriptResult.diarizedTranscript,
        product: input.product,
        agentName: input.agentName,
      };
      const {output: scoringOutput} = await scoreCallPrompt(promptInput);
      if (!scoringOutput) {
        throw new Error("AI failed to generate scoring details.");
      }
      const finalOutput: ScoreCallOutput = {
        ...scoringOutput,
        transcript: transcriptResult.diarizedTranscript,
        transcriptAccuracy: transcriptResult.accuracyAssessment,
      };
      return finalOutput;
    } catch (err) {
      const error = err as Error;
      console.error("Error in scoreCallFlow (scoring part):", error);
      const errorOutput: ScoreCallOutput = {
        transcript: transcriptResult.diarizedTranscript,
        transcriptAccuracy: transcriptResult.accuracyAssessment,
        overallScore: 0,
        callCategorisation: "Error",
        metricScores: [{ metric: "Scoring", score: 1, feedback: `AI scoring failed: ${error.message}. Ensure Google API Key is set and valid.` }],
        summary: `Failed to score call: ${error.message}`,
        strengths: [],
        areasForImprovement: ["AI service for scoring might be unavailable or encountered an issue."]
      };
      return errorOutput;
    }
  }
);

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling scoreCallFlow:", error);
    // Explicitly type the errorOutput to match ScoreCallOutput
    const errorOutput: ScoreCallOutput = {
      transcript: "[System Error during scoring process]",
      transcriptAccuracy: "Unknown",
      overallScore: 0,
      callCategorisation: "Error",
      metricScores: [{ metric: "System", score: 1, feedback: `Critical error: ${error.message}. Check server logs.` }],
      summary: `Call scoring failed due to a system error: ${error.message}`,
      strengths: [],
      areasForImprovement: ["Contact support."]
    };
    return errorOutput;
  }
}
