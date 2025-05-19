
'use server';
/**
 * @fileOverview Audio transcription flow with speaker diarization and accuracy assessment.
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
  diarizedTranscript: z.string().describe(
    'The textual transcript of the audio, formatted as a script with speaker labels (e.g., "Agent: ...", "User: ...", or "Speaker 1: ..."). The entire transcript MUST BE IN ENGLISH.'
  ),
  accuracyAssessment: z.string().describe(
    "A qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium due to background noise', 'Low due to overlapping speech')."
  ),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  return transcriptionFlow(input);
}

const transcriptionModel = 'googleai/gemini-2.0-flash'; 

const prompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscriptionInputSchema},
  output: {schema: TranscriptionOutputSchema},
  prompt: `Please transcribe the provided audio into text, identifying different speakers.
The output transcript MUST BE IN ENGLISH.
If the original audio contains a mix of languages (e.g., Hindi and English, or Hinglish), you MUST translate all non-English parts and provide the entire transcript in English.
If the audio is entirely in a language other than English, you MUST translate the entire content into English for the transcript.

Format the transcript as a script, prefixing each line of dialogue with "Agent:", "User:", or if roles are unclear, "Speaker 1:", "Speaker 2:", etc. For example:
Agent: Hello, how can I help you?
User: I have a question about my subscription.

Strive for the highest accuracy possible, capturing all spoken words by all parties clearly.
If parts of the audio are unclear or inaudible, indicate this in the transcript with "[inaudible]" or "[unclear speech]". Do not attempt to guess words that are not clear.

After the transcript, provide a brief qualitative 'accuracyAssessment' of the transcription (e.g., "High", "Medium due to background noise", "Low due to overlapping speech or poor audio quality").

Audio: {{media url=audioDataUri}}`,
  config: {
     responseModalities: ['TEXT'], 
  },
  model: transcriptionModel, 
});

const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput) => {
    const {output} = await prompt(input);
    if (!output || typeof output.diarizedTranscript !== 'string' || typeof output.accuracyAssessment !== 'string') {
      console.error("Transcription flow: Prompt returned null or invalid output.", input.audioDataUri.substring(0,50));
      return { 
        diarizedTranscript: "[Error: AI transcription failed to produce a valid text output. The prompt might have failed or returned an unexpected format. Check server logs.]",
        accuracyAssessment: "Error in processing."
      };
    }
    if (output.diarizedTranscript.trim() === "") {
        return { 
            diarizedTranscript: "[No speech detected or audio fully inaudible]",
            accuracyAssessment: "Undetermined (no speech)"
        };
    }
    return output;
  }
);

