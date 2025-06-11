
'use server';

/**
 * @fileOverview Call scoring analysis flow.
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
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
  prompt: `You are an expert call quality analyst. Your task is to objectively and consistently score a sales call.
Analyze the provided call transcript for a sales call regarding '{{{product}}}'.
{{#if agentName}}The agent's name is {{{agentName}}}.{{/if}}

Transcript:
{{{transcript}}}

Based *strictly* on the transcript and product context, evaluate the call across these metrics:
- Opening & Rapport Building
- Needs Discovery
- Product Presentation (relevance to {{{product}}})
- Objection Handling
- Closing Effectiveness
- Clarity & Communication
- Agent's Tone & Professionalism (Provide a distinct score and feedback for this based *only* on what can be inferred from the transcript)
- User's Perceived Sentiment (Provide a distinct score and feedback for this based *only* on what can be inferred from the transcript)
- Product Knowledge (specific to {{{product}}}, as demonstrated in the transcript)

Provide an overall score (1-5, where 1 is poor and 5 is excellent), a categorization (Very Good, Good, Average, Bad, Very Bad), scores and detailed feedback for each metric (ensuring 'Agent's Tone & Professionalism' and 'User's Perceived Sentiment' are explicitly included with their own scores and feedback).
The feedback for each metric should be specific and reference parts of the transcript if possible.
Also, provide a concise summary of the call, 2-3 key strengths observed, and 2-3 specific, actionable areas for improvement.
Be as objective as possible in your scoring.
`,
  model: 'googleai/gemini-2.0-flash',
  config: {
    temperature: 0.2, // Lower temperature for more deterministic and consistent scoring
  }
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
    } catch (transcriptionServiceError) {
      const err = transcriptionServiceError as Error;
      console.error("Critical error calling transcribeAudio service from scoreCallFlow:", err);
      // This catch block handles if transcribeAudio itself throws an unhandled error
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

    // Explicitly check if the transcription step reported an error in its output
    if (transcriptResult.accuracyAssessment === "Error" ||
        (transcriptResult.diarizedTranscript && (
            transcriptResult.diarizedTranscript.startsWith("[Transcription Error") ||
            transcriptResult.diarizedTranscript.startsWith("[Transcription API Error") ||
            transcriptResult.diarizedTranscript.startsWith("[Transcription Timeout") ||
            transcriptResult.diarizedTranscript.startsWith("[Transcription Blocked") ||
            transcriptResult.diarizedTranscript.startsWith("[Critical Transcription System Error") ||
            transcriptResult.diarizedTranscript.startsWith("[AI returned an empty transcript")
        ))) {
      console.warn("scoreCallFlow: Transcription step reported an error. Content:", transcriptResult.diarizedTranscript);
      return {
        transcript: transcriptResult.diarizedTranscript, // This contains the specific error message from transcription
        transcriptAccuracy: transcriptResult.accuracyAssessment, // Should be "Error" or a specific error status
        overallScore: 0,
        callCategorisation: "Error",
        metricScores: [{ metric: "Transcription Process", score: 1, feedback: `Transcription failed. Details: ${transcriptResult.diarizedTranscript.substring(0, 250)}` }],
        summary: "Call scoring aborted because the audio transcription step failed or returned an error.",
        strengths: [],
        areasForImprovement: ["Address the transcription issue (e.g., check audio file size/format, API key validity, or wait if it was a timeout) and try again."]
      };
    }

    // Proceed with scoring if transcription was successful
    try {
      const promptInput: z.infer<typeof ScoreCallPromptInputSchema> = {
        transcript: transcriptResult.diarizedTranscript,
        product: input.product,
        agentName: input.agentName,
      };
      const {output: scoringOutput} = await scoreCallPrompt(promptInput);
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
      console.error("Error in scoreCallFlow (AI scoring part):", error);
      // This error is specific to the AI scoring prompt failing, after a successful transcription
      return {
        transcript: transcriptResult.diarizedTranscript, // Transcript was successful
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

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling scoreCallFlow from exported function:", error);
    // This handles unexpected errors from the scoreCallFlow itself (not AI errors caught within)
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

