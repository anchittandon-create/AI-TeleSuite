
'use server';

/**
 * @fileOverview Call scoring analysis flow.
 *
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { transcribeAudio } from './transcription-flow'; 
import type { TranscriptionOutput } from './transcription-flow';
import { PRODUCTS, Product, CALL_SCORE_CATEGORIES, CallScoreCategory } from '@/types'; // Updated imports

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  product: z.enum(PRODUCTS).describe("The product (ET or TOI) that the call is primarily about. This context is crucial for scoring."), // Updated
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
  overallScore: z.number().min(1).max(5).describe('The overall call score (1-5) based on all evaluated metrics.'),
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES).describe("Overall category of the call performance (e.g., 'Very Good', 'Good', 'Average', 'Bad', 'Very Bad'). Provide a category that best reflects the overall score and performance."), // Updated
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context, inferred tonality, and sentiment."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product, and overall sentiment observed."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product and agent conduct.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning their product handling, communication, or responses to user sentiment.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input);
  } catch (e) {
    console.error("Catastrophic error in scoreCall flow INVOCATION:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected catastrophic error occurred invoking the call scoring flow.";
    return {
      transcript: `[System Error: Call scoring flow failed to invoke. ${errorMessage.substring(0,100)}]`,
      transcriptAccuracy: "System Error",
      overallScore: 1,
      callCategorisation: "Error",
      metricScores: [{ metric: "Flow Invocation Error", score: 1, feedback: `Details: ${errorMessage.substring(0,200)}` }],
      summary: `Call scoring failed catastrophically: ${errorMessage.substring(0,200)}. Check server logs and API key (ensure it is set in .env).`,
      strengths: ["N/A due to system error"],
      areasForImprovement: ["Resolve system error to proceed with scoring. Ensure API key is set in .env."]
    };
  }
}

const ScoreCallPromptInputSchema = z.object({
  transcript: z.string().describe("The transcript of the call. This may include speaker labels like 'Agent:' or 'User:' and be in Roman script (possibly with transliterated Hindi)."),
  transcriptAccuracy: z.string().describe("The AI's assessment of the transcript's accuracy."),
  product: z.enum(PRODUCTS).describe('The product being discussed/pitched in the call (ET or TOI).'), // Updated
  agentName: z.string().optional().describe('The name of the agent.'),
});

const ScoreCallPromptOutputSchema = ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true });


const scoreCallPrompt = ai.definePrompt({
  name: 'scoreCallPrompt',
  input: {schema: ScoreCallPromptInputSchema},
  output: {schema: ScoreCallPromptOutputSchema},
  prompt: `You are an expert Sales Call Analyst. Your task is to analyze a sales call transcript for a call regarding the product: {{{product}}}.
The transcript is provided by another AI, along with its accuracy assessment. The transcript may contain speaker labels (e.g., "Agent:", "User:") and might be in Roman script containing transliterated Hindi words.
Agent Name (if provided): {{{agentName}}}
Transcript Accuracy Assessment from previous AI: {{{transcriptAccuracy}}}

Transcript:
{{{transcript}}}

Instructions:
1.  **Sentiment and Tonality Inference**: Based on the provided transcript, carefully analyze the language, word choices, and conversational flow. Infer the likely sentiment (e.g., positive, negative, neutral, frustrated, interested, hesitant) and dominant tones (e.g., professional, empathetic, rushed, confident, unclear, annoyed) for both the Agent and the User throughout the call.
2.  **Overall Evaluation**: Evaluate the call against standard sales call best practices. Pay special attention to how effectively the agent represented, explained, and sold {{{product}}}. Consider the inferred sentiment and tonality in your evaluation.
3.  Provide an 'overallScore' from 1 (Poor) to 5 (Excellent), reflecting the agent's performance with {{{product}}}.
4.  Categorize the call's performance into 'callCategorisation'. Use one of these categories: "Very Good", "Good", "Average", "Bad", "Very Bad".
5.  Provide a 'summary' of the call, including key discussion points, outcomes, overall sentiment/tone observed, and how they related to {{{product}}}.
6.  Identify 2-3 key 'strengths' demonstrated by the agent, particularly in relation to pitching, discussing, handling objections for {{{product}}}, and managing call dynamics (e.g., maintaining a positive tone, showing empathy).
7.  Identify 2-3 specific, actionable 'areasForImprovement' for the agent, especially concerning their knowledge, presentation, objection handling related to {{{product}}}, or adapting to user's sentiment/tone.
8.  Provide detailed 'metricScores'. For each metric, include the 'metric' name, its 'score' (1-5), and 'feedback'. Your feedback should reflect how product-specific knowledge, inferred sentiment/tonality, and communication skills related to {{{product}}} were demonstrated.
    Evaluate at least the following metrics, adapting them based on the call's content:
    - Opening & Rapport Building (consider initial tone and user engagement)
    - Needs Discovery (as it relates to {{{product}}}, and understanding user's implicit needs)
    - Product Presentation (effectiveness, accuracy of {{{product}}} pitch, confidence)
    - Objection Handling (for {{{product}}}-related objections, empathy in responses)
    - Call Control & Pacing (agent's ability to guide the conversation appropriately)
    - Clarity & Communication Style (agent's language, avoidance of jargon, active listening cues)
    - Agent's Tone & Professionalism (inferred from language, politeness, respect)
    - User's Perceived Sentiment & Engagement (inferred from user's language, how agent adapted)
    - Closing Effectiveness (in context of {{{product}}} and overall call sentiment)
    - Product Knowledge (specific to {{{product}}})

If the transcript accuracy is rated low by the previous AI, acknowledge this in your summary and advise caution in interpreting the analysis.
Return the entire analysis in the specified JSON output format. The transcript and its accuracy are provided as input and should not be part of your direct JSON output.
IMPORTANT: Do NOT suggest offering a free trial to the user as a sales tactic or area of improvement.
`,
});

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    let transcriptionResult: TranscriptionOutput = {
        diarizedTranscript: "[Transcription Error: Could not transcribe audio.]",
        accuracyAssessment: "Transcription process failed."
    };
    let analysisError = "";

    try {
      try {
        transcriptionResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
      } catch (transcriptionError) {
        console.error("Error during transcription step in scoreCallFlow:", transcriptionError);
        analysisError = transcriptionError instanceof Error ? transcriptionError.message : "Transcription step failed.";
        // Use default transcriptionResult indicating error
      }

      const promptInput: z.infer<typeof ScoreCallPromptInputSchema> = {
        transcript: transcriptionResult.diarizedTranscript,
        transcriptAccuracy: transcriptionResult.accuracyAssessment,
        agentName: input.agentName,
        product: input.product,
      };

      // If transcription failed significantly, we might still attempt scoring but note it.
      // Or, we could return early if transcript is essential and unusable.
      // For now, we proceed but the prompt is aware of transcriptAccuracy.

      const {output: analysisOutput} = await scoreCallPrompt(promptInput);
      
      if (!analysisOutput) {
        const errorMessage = "AI analysis prompt returned no output. Check transcript accuracy and API key.";
        console.error("Call scoring flow: scoreCallPrompt returned null output for input:", input.agentName, input.product);
        return {
          transcript: transcriptionResult.diarizedTranscript,
          transcriptAccuracy: transcriptionResult.accuracyAssessment,
          overallScore: 1,
          callCategorisation: "Error",
          metricScores: [{ metric: "Analysis Status", score: 1, feedback: errorMessage }],
          summary: "The AI analysis process encountered an error: " + errorMessage,
          strengths: ["Analysis incomplete due to an error."],
          areasForImprovement: ["Resolve AI analysis error to get feedback. Ensure API key is set in .env."]
        };
      }
      
      return {
        transcript: transcriptionResult.diarizedTranscript,
        transcriptAccuracy: transcriptionResult.accuracyAssessment,
        ...analysisOutput,
      };

    } catch (flowError) {
      console.error("Critical error in scoreCallFlow execution:", flowError);
      const errorMessage = flowError instanceof Error ? flowError.message : "An unexpected critical error occurred in the call scoring flow.";
      return {
        transcript: transcriptionResult.diarizedTranscript, // transcript may still have the initial error message if transcription failed early
        transcriptAccuracy: transcriptionResult.accuracyAssessment || "Error",
        overallScore: 1,
        callCategorisation: "Error",
        metricScores: [{ metric: "Flow Execution Error", score: 1, feedback: `Details: ${errorMessage.substring(0,200)}` }],
        summary: `Call scoring failed due to a system error: ${errorMessage.substring(0,200)}. Check server logs and API key.`,
        strengths: ["N/A due to system error"],
        areasForImprovement: ["Resolve system error to proceed with scoring. Ensure API key is set in .env."]
      };
    }
  }
);

