
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
    'The **complete and full** textual transcript of the audio, formatted as a script. Attempt to identify two primary speakers as "Agent:" and "User:". If unable to distinguish, use "Speaker 1:", "Speaker 2:", etc. Clearly label any non-speech sounds like (Background Sound). The transcript MUST use the English (Roman) script ONLY. If Hindi or Hinglish words are spoken, they should be transliterated into Roman script (e.g., "kya" for क्या, "kaun" for कौन, "aap kaise hain" not "आप कैसे हैं" or "how are you"). Absolutely NO Devanagari or other non-Roman script characters should be present in the output.'
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

Instructions for Transcription:
1.  **Diarization:** Provide a diarized transcript. Attempt to identify and label the primary speakers as "Agent:" and "User:". If this distinction is not clear from the audio, you may use generic labels like "Speaker 1:", "Speaker 2:", etc.
2.  **Non-Speech Sounds:** Identify and label any significant non-speech sounds clearly within parentheses, for example: (Background Sound), (Keyboard Typing), (Door Close).
3.  **Language & Script (CRITICAL):** The entire transcript MUST be in English (Roman script) ONLY. If Hindi or Hinglish words or phrases are spoken, they MUST be transliterated into Roman script (e.g., "kya" for क्या, "kaun" for कौन, "aap kaise hain" NOT "आप कैसे हैं", "achha theek hai" NOT "अच्छा ठीक है"). Do NOT translate them into English; transliterate them into Roman characters. Absolutely NO Devanagari script or any other non-Roman script characters should appear in the output.
4.  **Accuracy Assessment:** Provide a qualitative assessment of the transcription's accuracy (e.g., 'High', 'Medium due to background noise', 'Low due to overlapping speech').
`,
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
      const errorResult: TranscriptionOutput = {
        diarizedTranscript: `[Transcription Error. Ensure API key is valid, audio format is supported, and check server logs. Details: ${error.message.substring(0,100)}]`,
        accuracyAssessment: "Error"
      };
      return errorResult;
    }
  }
);

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  try {
    return await transcriptionFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling transcriptionFlow:", error);
    const errorResult: TranscriptionOutput = {
      diarizedTranscript: `[Critical Transcription System Error. Check server logs. Details: ${error.message.substring(0,100)}]`,
      accuracyAssessment: "System Error"
    };
    return errorResult;
  }
}

