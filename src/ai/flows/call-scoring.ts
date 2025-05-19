
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
import { transcribeAudio, type TranscriptionInput } from './transcription-flow'; // Import the shared transcription flow
import { PRODUCTS, Product } from '@/types';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  product: z.enum(PRODUCTS).describe("The product (ETPrime or TOI+) that the call is primarily about. This context is crucial for scoring."),
  agentName: z.string().optional().describe('The name of the agent.'),
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

const MetricScoreSchema = z.object({
  metric: z.string().describe("Name of the performance metric (e.g., 'Opening Quality', 'Needs Discovery', 'Product Presentation', 'Objection Handling', 'Closing Effectiveness', 'Clarity', 'Tone', 'Pacing', 'Product Knowledge')."),
  score: z.number().min(1).max(5).describe("Score for this specific metric (1-5)."),
  feedback: z.string().describe("Specific feedback, observations, or comments related to this metric, especially concerning the selected product.")
});

const ScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of the call conversation (potentially diarized with speaker labels like "Agent:" or "User:").'),
  overallScore: z.number().min(1).max(5).describe('The overall call score (1-5) based on all evaluated metrics.'),
  callCategorisation: z.string().describe("Overall category of the call performance (e.g., 'Excellent', 'Good', 'Fair', 'Needs Improvement', 'Poor'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning the product handling.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  return scoreCallFlow(input);
}

// Define the input schema for the scoring prompt, which will receive the transcript
const ScoreCallPromptInputSchema = z.object({
  transcript: z.string().describe("The transcript of the call. This may include speaker labels like 'Agent:' or 'User:'."),
  product: z.enum(PRODUCTS).describe('The product being discussed/pitched in the call (ETPrime or TOI+).'),
  agentName: z.string().optional().describe('The name of the agent.'),
});

// The output schema for the prompt will omit the transcript, as the flow will add it back.
const ScoreCallPromptOutputSchema = ScoreCallOutputSchema.omit({ transcript: true });


const scoreCallPrompt = ai.definePrompt({
  name: 'scoreCallPrompt',
  input: {schema: ScoreCallPromptInputSchema},
  output: {schema: ScoreCallPromptOutputSchema}, // Output doesn't include transcript
  prompt: `You are an expert Sales Call Analyst. Your task is to analyze a sales call transcript for a call regarding the product: {{{product}}}.
The transcript may contain speaker labels like "Agent:" and "User:".
Agent Name (if provided): {{{agentName}}}

Transcript:
{{{transcript}}}

Instructions:
1.  Based on the provided transcript and the product context ({{{product}}}), evaluate the call against standard sales call best practices. Pay special attention to how effectively the agent represented, explained, and sold {{{product}}}.
2.  Provide an 'overallScore' from 1 (Poor) to 5 (Excellent), reflecting the agent's performance with {{{product}}}.
3.  Categorize the call's performance into 'callCategorisation' (e.g., 'Excellent', 'Good', 'Fair', 'Needs Improvement', 'Poor').
4.  Provide a 'summary' of the call, including key discussion points, outcomes, and how they related to {{{product}}}.
5.  Identify 2-3 key 'strengths' demonstrated by the agent, particularly in relation to pitching, discussing, or handling objections for {{{product}}}.
6.  Identify 2-3 specific, actionable 'areasForImprovement' for the agent, especially concerning their knowledge, presentation, or objection handling related to {{{product}}}.
7.  Provide detailed 'metricScores'. For each metric, include the 'metric' name, its 'score' (1-5), and 'feedback'. Evaluate how product-specific knowledge and skills related to {{{product}}} were demonstrated.
    Evaluate at least the following metrics, and add others if relevant:
    - Opening & Rapport Building
    - Needs Discovery (as it relates to {{{product}}})
    - Product Presentation (effectiveness and accuracy of {{{product}}} pitch)
    - Objection Handling (for {{{product}}}-related objections)
    - Call Control & Pacing
    - Clarity & Communication Style
    - Closing Effectiveness (in context of {{{product}}})
    - Tone & Professionalism
    - Product Knowledge (specific to {{{product}}})

Return the entire analysis in the specified JSON output format. The transcript itself is provided as input and should not be part of your direct JSON output.
`,
});

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput) => {
    let transcriptText = "[Transcription Error: Could not transcribe audio.]";
    // let transcriptionAccuracy = "Transcription accuracy not assessed due to error.";
    try {
      const transcriptionResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
      transcriptText = transcriptionResult.diarizedTranscript;
      // transcriptionAccuracy = transcriptionResult.accuracyAssessment; // We have this, but not directly using in scoring prompt yet.
    } catch (transcriptionError) {
      console.error("Error during transcription step in scoreCallFlow:", transcriptionError);
      // transcriptText remains the error message
    }

    const promptInput: z.infer<typeof ScoreCallPromptInputSchema> = {
      transcript: transcriptText,
      agentName: input.agentName,
      product: input.product,
    };

    const {output: analysisOutput} = await scoreCallPrompt(promptInput);
    
    if (!analysisOutput) {
      console.error("Call scoring flow: scoreCallPrompt returned null output for input:", input.agentName, input.product);
      return {
        transcript: transcriptText,
        overallScore: 1,
        callCategorisation: "Error",
        metricScores: [{ metric: "Analysis Status", score: 1, feedback: "AI failed to analyze the call. The scoring prompt might have failed." }],
        summary: "The AI analysis process encountered an error and could not provide a score or detailed feedback.",
        strengths: ["Analysis incomplete due to an error."],
        areasForImprovement: ["Resolve AI analysis error to get feedback."]
      };
    }
    
    return {
      transcript: transcriptText,
      ...analysisOutput,
    };
  }
);

