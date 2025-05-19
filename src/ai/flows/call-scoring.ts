
'use server';

/**
 * @fileOverview Call performance analysis flow.
 *
 * - scoreCall - A function that handles the call performance analysis process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  agentName: z.string().optional().describe('The name of the agent.'),
  // Optional context field for providing specific metrics or aspects to focus on, if needed in future
  // evaluationContext: z.string().optional().describe("Specific context or script agent was supposed to follow, if any.")
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

const MetricScoreSchema = z.object({
  metric: z.string().describe("Name of the performance metric (e.g., 'Opening Quality', 'Needs Discovery', 'Product Presentation', 'Objection Handling', 'Closing Effectiveness', 'Clarity', 'Tone', 'Pacing')."),
  score: z.number().min(1).max(5).describe("Score for this specific metric (1-5)."),
  feedback: z.string().describe("Specific feedback, observations, or comments related to this metric.")
});

const ScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of the call conversation.'),
  overallScore: z.number().min(1).max(5).describe('The overall call score (1-5) based on all evaluated metrics.'),
  callCategorisation: z.string().describe("Overall category of the call performance (e.g., 'Excellent', 'Good', 'Fair', 'Needs Improvement', 'Poor'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 5-7 key metrics relevant to sales calls."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  return scoreCallFlow(input);
}

// This tool remains internal to this flow for now.
// A separate transcription flow will be created for the dedicated transcription module.
const transcribeCallTool = ai.defineTool({
  name: 'transcribeCallTool',
  description: 'Transcribes an audio recording of a call into text.',
  inputSchema: z.object({
    audioDataUri: z
      .string()
      .describe(
        "An audio file of a call recording, as a data URI."
      ),
  }),
  outputSchema: z.string().describe("The textual transcript of the audio."),
}, async (input) => {
  const {text} = await ai.generate({
    model: 'googleai/gemini-2.0-flash', // Assuming this model can handle audio transcription
    prompt: [
      {media: {url: input.audioDataUri}},
      {text: 'Transcribe this audio recording accurately. Capture all spoken words by all parties.'},
    ],
    config: {
      responseModalities: ['TEXT'], // Ensure model is capable of this
    },
  });
  return text!;
});

const callPerformancePrompt = ai.definePrompt({
  name: 'callPerformancePrompt',
  input: {schema: ScoreCallInputSchema},
  output: {schema: ScoreCallOutputSchema},
  tools: [transcribeCallTool],
  prompt: `You are an expert Sales Call Analyst. Your task is to analyze a sales call recording.
Agent Name (if provided): {{{agentName}}}

Instructions:
1.  First, use the 'transcribeCallTool' to get the full transcript of the audio.
2.  Based on the transcript, evaluate the call against standard sales call best practices.
3.  Provide an 'overallScore' from 1 (Poor) to 5 (Excellent).
4.  Categorize the call's performance into 'callCategorisation' (e.g., 'Excellent', 'Good', 'Fair', 'Needs Improvement', 'Poor').
5.  Provide a 'summary' of the call, including key discussion points and outcome.
6.  Identify 2-3 key 'strengths' demonstrated by the agent.
7.  Identify 2-3 specific, actionable 'areasForImprovement' for the agent.
8.  Provide detailed 'metricScores'. For each metric, include the 'metric' name, its 'score' (1-5), and 'feedback'.
    Evaluate at least the following metrics, and add others if relevant:
    - Opening & Rapport Building
    - Needs Discovery & Qualification
    - Product/Service Presentation
    - Objection Handling
    - Call Control & Pacing
    - Clarity & Communication Style
    - Closing Effectiveness (if applicable)
    - Tone & Professionalism

Return the entire analysis in the specified JSON output format. Ensure the transcript is included.
Audio for transcription and analysis is implicitly available from the input 'audioDataUri' for the tool.
`,
});

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async input => {
    // The prompt itself will invoke the transcribeCallTool as needed.
    // The LLM will use the output of the tool to perform the rest of the analysis.
    const {output} = await callPerformancePrompt(input);
    
    if (!output) {
      throw new Error("Failed to get a structured response from the AI for call scoring.");
    }
    return output;
  }
);
