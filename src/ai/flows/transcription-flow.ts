
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
  transcript: z.string().describe('The textual transcript of the audio, in English.'),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  return transcriptionFlow(input);
}

// Using a model known for good transcription capabilities.
// Gemini 2.0 Flash can handle multimodal input including audio.
const transcriptionModel = 'googleai/gemini-2.0-flash'; 

const prompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscriptionInputSchema},
  output: {schema: TranscriptionOutputSchema},
  prompt: `Please transcribe the provided audio into text. 
The output must be in English.
If the audio contains a mix of languages (e.g., Hindi and English, or Hinglish), please ensure the entire transcript is in English.
Strive for the highest accuracy possible, capturing all spoken words by all parties clearly.
If parts of the audio are unclear or inaudible, indicate this in the transcript (e.g., "[inaudible]" or "[unclear speech]").

Audio: {{media url=audioDataUri}}`,
  config: {
     responseModalities: ['TEXT'], 
  },
  model: transcriptionModel, // Explicitly specifying the model for this prompt
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
      console.error("Transcription flow: Prompt returned null or invalid output for transcript.", input.audioDataUri.substring(0,50));
      // Return a structured error message that conforms to the schema
      return { transcript: "[Error: AI transcription failed to produce a valid text output. The prompt might have failed or returned an unexpected format. Check server logs.]" };
    }
    // Handle cases where the AI might explicitly return an empty string if it genuinely couldn't transcribe anything.
    // Or, if the model is robust, it might return "[inaudible]" itself based on the prompt.
    if (output.transcript.trim() === "") {
        return { transcript: "[No speech detected or audio fully inaudible]" };
    }
    return output;
  }
);

