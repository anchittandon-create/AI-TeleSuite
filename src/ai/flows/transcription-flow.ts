
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
    'The **complete and full** textual transcript of the audio, formatted as a script with speaker labels (e.g., "Agent: ...", "User: ...", or "Speaker 1: ..."). The transcript MUST use the English (Roman) script. If Hindi or Hinglish words are spoken, they should be transliterated into Roman script (e.g., "aap kaise hain" not "आप कैसे हैं" or "how are you").'
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
  prompt: `Your primary task is to accurately transcribe the provided audio into text. Ensure the entire audible spoken content is transcribed from beginning to end. Provide a full and complete transcript.

Key Requirements:
1.  **Script Language**: The entire output transcript MUST be in the English (Roman) script.
2.  **Handling Mixed Languages (Hinglish/Hindi)**: If the audio contains Hindi words or Hinglish (a mix of Hindi and English), you MUST **transliterate** these Hindi words into the Roman script. Do NOT translate Hindi words into English vocabulary. For example:
    *   If a speaker says 'आप कैसे हैं?' (aap kaise hain?), transcribe it as 'aap kaise hain?'.
    *   If a speaker says 'mujhe yeh plan aacha lagaa', transcribe it as 'mujhe yeh plan aacha lagaa'.
    *   Do NOT translate 'aap kaise hain?' to 'how are you?'.
3.  **Speaker Diarization**: Identify different speakers in the audio. Format the transcript as a script, prefixing each line of dialogue with "Agent:", "User:", or if roles are unclear, "Speaker 1:", "Speaker 2:", etc. Example:
    Agent: Hello, how can I help you?
    User: I have a question about my subscription.
4.  **Accuracy**: Strive for the highest possible accuracy. Capture all spoken words clearly.
5.  **Unclear Audio**: If parts of the audio are unclear or inaudible, indicate this in the transcript with "[inaudible]" or "[unclear speech]". Do not guess words that are not clear.
6.  **Accuracy Assessment**: After the transcript, provide a brief qualitative 'accuracyAssessment' of the transcription (e.g., "High", "Medium due to significant background noise", "Low due to overlapping speech and poor audio quality"). Be specific if there are particular challenges.

Audio: {{media url=audioDataUri}}`,
  config: {
     responseModalities: ['TEXT'], 
     // Safety settings can be adjusted if needed, but default is usually fine for transcription.
     // Consider adjusting if specific content is being blocked, but be mindful of policy.
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

