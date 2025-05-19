
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
    model: 'googleai/gemini-2.0-flash',
    prompt: [
      {media: {url: input.audioDataUri}},
      {text: 'Transcribe this audio recording accurately. Capture all spoken words by all parties.'},
    ],
    config: {
      responseModalities: ['TEXT'],
    },
  });
  
  // If 'text' is not a string or is empty, return a placeholder string
  // to satisfy the tool's z.string() outputSchema and prevent a crash.
  if (typeof text === 'string' && text.trim() !== '') {
    return text;
  }
  
  // Log the issue for debugging purposes
  console.warn(`Transcription tool for call scoring received no text from AI for: ${input.audioDataUri.substring(0,100)}... Returning placeholder.`);
  return "[Audio not transcribed or empty transcript returned by AI]";
});

const callPerformancePrompt = ai.definePrompt({
  name: 'callPerformancePrompt',
  input: {schema: ScoreCallInputSchema},
  output: {schema: ScoreCallOutputSchema},
  tools: [transcribeCallTool],
  prompt: `You are an expert Sales Call Analyst. Your task is to analyze a sales call recording.
Agent Name (if provided): {{{agentName}}}

Instructions:
1.  First, use the 'transcribeCallTool' to get the full transcript of the audio. The tool will return "[Audio not transcribed or empty transcript returned by AI]" if transcription fails.
2.  Based on the transcript (even if it indicates a transcription error), evaluate the call against standard sales call best practices. If the transcript is an error message, note this in your summary and other relevant fields.
3.  Provide an 'overallScore' from 1 (Poor) to 5 (Excellent). If transcription failed, this score might be low or reflect inability to analyze.
4.  Categorize the call's performance into 'callCategorisation' (e.g., 'Excellent', 'Good', 'Fair', 'Needs Improvement', 'Poor').
5.  Provide a 'summary' of the call, including key discussion points and outcome. If transcription failed, summarize that.
6.  Identify 2-3 key 'strengths' demonstrated by the agent (or note if analysis is not possible).
7.  Identify 2-3 specific, actionable 'areasForImprovement' for the agent (or note if analysis is not possible).
8.  Provide detailed 'metricScores'. For each metric, include the 'metric' name, its 'score' (1-5), and 'feedback'. If transcription failed, metrics scores may be 1 or reflect inability to score, with feedback explaining why.
    Evaluate at least the following metrics, and add others if relevant:
    - Opening & Rapport Building
    - Needs Discovery & Qualification
    - Product/Service Presentation
    - Objection Handling
    - Call Control & Pacing
    - Clarity & Communication Style
    - Closing Effectiveness (if applicable)
    - Tone & Professionalism

Return the entire analysis in the specified JSON output format. Ensure the transcript field contains the result from the transcription tool.
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
    const {output} = await callPerformancePrompt(input);
    
    if (!output) {
      console.error("Call scoring flow: callPerformancePrompt returned null output for input:", input.agentName, input.audioDataUri.substring(0,50));
      // Attempt to return a valid, minimal ScoreCallOutput object to prevent crashes downstream
      // and provide some feedback to the user.
      return {
        transcript: "[Error: AI analysis failed to produce a structured response. The prompt might have failed. Check server logs.]",
        overallScore: 1,
        callCategorisation: "Error",
        metricScores: [{ metric: "Analysis Status", score: 1, feedback: "AI failed to analyze the call." }],
        summary: "The AI analysis process encountered an error and could not provide a score or detailed feedback.",
        strengths: ["Analysis incomplete due to an error."],
        areasForImprovement: ["Resolve AI analysis error to get feedback."]
      };
    }
    return output;
  }
);
