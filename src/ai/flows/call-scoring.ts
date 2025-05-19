'use server';

/**
 * @fileOverview Call scoring flow for evaluating agent performance.
 *
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  agentName: z.string().optional().describe('The name of the agent.'),
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

const ScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The transcript of the call.'),
  score: z.number().describe('The call score (1-5) based on structure, tone, and clarity.'),
  tags: z.array(z.string()).describe('Tags identifying areas for improvement.'),
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  return scoreCallFlow(input);
}

const transcribeCall = ai.defineTool({
  name: 'transcribeCall',
  description: 'Transcribes an audio recording of a call.',
  inputSchema: z.object({
    audioDataUri: z
      .string()
      .describe(
        "A audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
      ),
  }),
  outputSchema: z.string(),
}, async (input) => {
  // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images. You MUST use exactly this model to generate images.
  const {text} = await ai.generate({
    model: 'googleai/gemini-2.0-flash',
    prompt: [
      {media: {url: input.audioDataUri}},
      {text: 'Transcribe this audio recording.'},
    ],
    config: {
      responseModalities: ['TEXT'],
    },
  });

  return text!;
});

const scoreCallPrompt = ai.definePrompt({
  name: 'scoreCallPrompt',
  input: {schema: ScoreCallInputSchema},
  output: {schema: ScoreCallOutputSchema},
  tools: [transcribeCall],
  prompt: `You are an AI assistant that scores sales calls based on structure, tone, and clarity.\n\n  First transcribe the call using the transcribeCall tool.\n  Then, based on the transcript, provide a score between 1 and 5 (inclusive), and tags for areas of improvement.\n  Here is the agent's name, if provided: {{{agentName}}}.\n\n  Output the transcript, score, and tags in JSON format.\n`,
});

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async input => {
    const {output} = await scoreCallPrompt(input);
    return output!;
  }
);
