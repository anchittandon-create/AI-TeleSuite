
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
    'The **complete and full** textual transcript of the audio, formatted as a script, transcribed with the highest possible accuracy. \nCritical Diarization Rules:\n1. If the call begins with audible ringing sounds, **including any automated announcements, IVR messages, or distinct pre-recorded voices that play *before* a human agent speaks**, label this entire initial non-human part as "Ringing:".\n2. The first *human* speaker who is clearly identifiable as the sales agent (distinguished by their conversational tone and content, *not* by automated announcements or system messages) should be labeled "Agent:". This label should *only* be used when the actual human agent definitively starts speaking.\n3. The other primary human speaker (the customer/user) should be labeled "User:".\n4. If it\'s unclear who speaks first (after any ringing/automated messages), or if the initial human speaker is not definitively the agent, use generic labels like "Speaker 1:", "Speaker 2:", etc., until the Agent and User roles can be clearly assigned.\n5. If, throughout the call, it\'s impossible to distinguish between Agent and User, consistently use "Speaker 1:" and "Speaker 2:".\n6. Clearly label any significant non-speech sounds within parentheses, for example: (Background Sound), (Silence), (Music), (Line Drop).\n\nCritical Language & Script Rules (STRICT):\n1.  The entire transcript MUST be in English (Roman script) ONLY.\n2.  If Hindi or Hinglish words or phrases are spoken, they MUST be accurately transliterated into Roman script (e.g., "kya" for क्या, "kaun" for कौन, "aap kaise hain" NOT "आप कैसे हैं", "achha theek hai" NOT "अच्छा ठीक है", "savdhan agar aapko" for "सावधान अगर आपको").\n3.  Do NOT translate these words into English; transliterate them directly into Roman characters.\n4.  Absolutely NO Devanagari script or any other non-Roman script characters are permitted in the output. The entire output must be valid Roman script.'
  ),
  accuracyAssessment: z.string().describe(
    "A qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium due to background noise', 'Low due to overlapping speech and poor audio quality'). Be specific if the quality of the audio makes certain parts hard to transcribe."
  ),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

const transcriptionModel = 'googleai/gemini-2.0-flash'; 

const transcribeAudioPrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscriptionInputSchema},
  output: {schema: TranscriptionOutputSchema},
  prompt: `Transcribe the following audio with the **utmost accuracy**, strictly adhering to all instructions.
Audio: {{media url=audioDataUri}}

Critical Instructions for Transcription Output:
1.  **Diarization and Speaker Labels (VERY IMPORTANT):**
    *   Provide a diarized transcript.
    *   If the call begins with audible ringing sounds, **including any automated announcements, IVR (Interactive Voice Response) messages, or distinct pre-recorded voices that play *before* a human agent speaks**, label this entire initial non-human part as "Ringing:". For example, if there's an automated "Savdhan agar aapko..." message before the agent, it should be part of "Ringing:".
    *   The first *human* speaker who is clearly identifiable as the sales agent (distinguished by their conversational tone, interaction, and content—not by automated announcements or system messages) should be labeled "Agent:". This label should *only* be used when the actual human agent definitively starts speaking.
    *   The other primary human speaker (the customer/user) should be labeled "User:".
    *   If it's unclear who speaks first (after any ringing/automated messages), or if the initial human speaker is not definitively the agent, use generic labels like "Speaker 1:", "Speaker 2:", etc., until the Agent and User roles can be clearly assigned.
    *   If, throughout the call, it's impossible to distinguish between Agent and User, consistently use "Speaker 1:" and "Speaker 2:".
2.  **Non-Speech Sounds:** Identify and label any significant non-speech sounds clearly within parentheses, for example: (Background Sound), (Silence), (Music), (Line Drop).
3.  **Language & Script (CRITICAL & STRICT):**
    *   The entire transcript MUST be in English (Roman script) ONLY.
    *   If Hindi or Hinglish words or phrases are spoken (e.g., "kya", "kaun", "aap kaise hain", "achha theek hai", "ji haan", "savdhan agar aapko"), they MUST be **accurately transliterated** into Roman script.
    *   Do NOT translate these words into English; transliterate them directly and accurately into Roman characters. (e.g., "kya" NOT "what", "savdhan agar aapko" NOT "be careful if you").
    *   Absolutely NO Devanagari script or any other non-Roman script characters are permitted in the output. The entire output MUST be valid Roman script characters.
4.  **Accuracy Assessment:** After transcription, provide a qualitative assessment of the transcription's accuracy (e.g., 'High', 'Medium due to background noise', 'Low due to overlapping speech and poor audio quality'). Be specific if the quality of the audio makes certain parts hard to transcribe or if automated announcements are present.
5.  **Completeness:** Ensure the transcript is **complete and full**, capturing the entire conversation.

Prioritize accuracy in transcription, speaker labeling, and transliteration above all else. Pay close attention to distinguishing pre-recorded system messages from human agent speech.
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
        throw new Error("AI failed to transcribe audio or returned an empty response. Check model availability and API key validity.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in transcriptionFlow (awaiting transcribeAudioPrompt):", error);
      
      let clientErrorMessage = `[Transcription Error. Ensure API key is valid, audio format is supported, and check server logs for details. Original error: ${error.message.substring(0,150)}]`;
      if (error.message.includes("https://generativelanguage.googleapis.com") || error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("permission denied")) {
        clientErrorMessage = `[Transcription API Error. Please verify your GOOGLE_API_KEY in the .env file, ensure it's valid, and that the Generative Language API is enabled in your Google Cloud project with billing active. Original error: ${error.message.substring(0,100)}]`;
      } else if (error.message.toLowerCase().includes("deadline exceeded") || error.message.toLowerCase().includes("timeout")) {
        clientErrorMessage = `[Transcription Timeout. The request took too long to process. This might be due to a very large audio file or a temporary issue with the AI service. Original error: ${error.message.substring(0,100)}]`;
      }
      
      const errorResult: TranscriptionOutput = {
        diarizedTranscript: clientErrorMessage,
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
    console.error("Catastrophic error calling transcriptionFlow from export function:", error);
    const errorResult: TranscriptionOutput = {
      diarizedTranscript: `[Critical Transcription System Error. Check server logs for details. Message: ${error.message.substring(0,100)}]`,
      accuracyAssessment: "System Error"
    };
    return errorResult;
  }
}

