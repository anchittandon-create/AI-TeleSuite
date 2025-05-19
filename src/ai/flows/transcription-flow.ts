
'use server';
/**
 * @fileOverview Simple audio transcription flow.
 *
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscriptionInput - The input type for the transcribeAudio function.
 * - TranscriptionOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscriptionInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscriptionInput = z.infer<typeof TranscriptionInputSchema>;

const TranscriptionOutputSchema = z.object({
  transcript: z.string().describe('The textual transcript of the audio.'),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  return transcriptionFlow(input);
}

const transcriptionModel = 'googleai/gemini-2.0-flash'; // Or another suitable model

const prompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscriptionInputSchema},
  output: {schema: TranscriptionOutputSchema},
  prompt: `Transcribe the provided audio accurately. Capture all spoken words by all parties.
Audio: {{media url=audioDataUri}}`,
  config: {
    // Ensure the model is capable of handling audio input and text output.
    // Specific config might be needed depending on the model.
    // For Gemini models that support multimodal input:
     responseModalities: ['TEXT'], 
  }
});

const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput) => {
    const {output} = await prompt(input);
    if (!output || typeof output.transcript !== 'string') {
      throw new Error('Failed to get a valid transcript from the AI.');
    }
    return output;
  }
);
