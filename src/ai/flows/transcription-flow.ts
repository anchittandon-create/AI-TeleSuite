
'use server';
/**
 * @fileOverview Audio transcription flow with speaker diarization and accuracy assessment.
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
    'The **complete and full** textual transcript of the audio, formatted as a script with speaker labels (e.g., "Agent: ...", "User: ...", or "Speaker 1: ..."). The transcript MUST use the English (Roman) script. If Hindi or Hinglish words are spoken, they should be transliterated into Roman script (e.g., "aap kaise hain" not "आप कैसे हैं" or "how are you").'
  ),
  accuracyAssessment: z.string().describe(
    "A qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium due to background noise', 'Low due to overlapping speech')."
  ),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

const transcriptionModel = 'googleai/gemini-2.0-flash'; 

const transcribeAudioPrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscriptionInputSchema},
  output: {schema: TranscriptionOutputSchema},
  prompt: `Transcribe the following audio accurately.
Audio: {{media url=audioDataUri}}

Instructions:
1.  Provide a diarized transcript, identifying different speakers (e.g., "Speaker 1:", "Speaker 2:", or "Agent:", "User:" if discernible).
2.  The entire transcript must be in English (Roman script). If Hindi or Hinglish words are spoken, transliterate them into Roman script (e.g., "namaste" not "नमस्ते").
3.  Assess the accuracy of the transcription (High, Medium, Low) and briefly note any factors affecting it (e.g., background noise, overlapping speech).
`,
  config: {
     responseModalities: ['TEXT'], // Ensure model understands it should primarily output text based on audio
  },
  model: transcriptionModel, 
});

const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput) : Promise<TranscriptionOutput> => {
    try {
      const {output} = await transcribeAudioPrompt(input);
      if (!output) {
        console.error("transcriptionFlow: Prompt returned no output.");
        throw new Error("AI failed to transcribe audio.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in transcriptionFlow:", error);
      return {
        diarizedTranscript: `[Transcription Error: ${error.message}. Ensure Google API Key is set and valid, and audio format is supported.]`,
        accuracyAssessment: "Error in processing"
      };
    }
  }
);

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  try {
    return await transcriptionFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling transcriptionFlow:", error);
    return {
      diarizedTranscript: `[Critical Transcription Error: ${error.message}. Check server logs.]`,
      accuracyAssessment: "System Error"
    };
  }
}
