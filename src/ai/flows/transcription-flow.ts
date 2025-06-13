
'use server';
/**
 * @fileOverview Audio transcription flow with speaker diarization, time allotments, and accuracy assessment.
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscriptionInput - The input type for the transcribeAudio function.
 * - TranscriptionOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

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
    'The **complete and full** textual transcript of the audio, formatted as a script. Each dialogue segment MUST be structured as follows:\n1. On a new line: The time allotment for that chunk, enclosed in square brackets (e.g., "[0 seconds - 15 seconds]", "[25 seconds - 40 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]"). The AI model determines these time segments based on the audio.\n2. On the *next* line: The speaker label in **bold markdown** (e.g., "**Agent:**", "**User:**", "**Ringing:**") followed by the transcribed text for that chunk.\nExample segment:\n[0 seconds - 12 seconds]\n**Ringing:** Welcome to our service. Please hold while we connect you.\n\n[15 seconds - 28 seconds]\n**Agent:** Hello, thank you for calling. This is Alex, how can I help you today?\n\nCritical Diarization Rules for Speaker Labels (must be bold):\n1. If the call begins with audible ringing sounds, including any automated announcements, IVR messages, or distinct pre-recorded voices that play *before* a human agent speaks, label this entire initial non-human part as "**Ringing:**".\n2. The first *human* speaker who is clearly identifiable as the sales agent (distinguished by their conversational tone and content, *not* by automated announcements or system messages) should be labeled "**Agent:**". This label should *only* be used when the actual human agent definitively starts speaking.\n3. The other primary human speaker (the customer/user) should be labeled "**User:**".\n4. If it\'s unclear who speaks first (after any ringing/automated messages), or if the initial human speaker is not definitively the agent, use generic labels like "**Speaker 1:**", "**Speaker 2:**", etc., until the Agent and User roles can be clearly assigned.\n5. If, throughout the call, it\'s impossible to distinguish between Agent and User, consistently use "**Speaker 1:**" and "**Speaker 2:**".\n6. Clearly label any significant non-speech sounds within parentheses (e.g., (Background Sound), (Silence), (Music), (Line Drop)) *within the text portion of the speaker line*, after the bolded speaker label.\n\nCritical Language & Script Rules (STRICT):\n1.  The entire transcript MUST be in English (Roman script) ONLY.\n2.  If Hindi or Hinglish words or phrases are spoken, they MUST be accurately transliterated into Roman script (e.g., "kya" for क्या, "kaun" for कौन, "aap kaise hain" NOT "आप कैसे हैं", "achha theek hai" NOT "अच्छा ठीक है", "savdhan agar aapko" for "सावधान अगर आपको").\n3.  Do NOT translate these words into English; transliterate them directly into Roman characters.\n4.  Absolutely NO Devanagari script or any other non-Roman script characters are permitted in the output. The entire output must be valid Roman script.\n\nTime Allotment Accuracy: Ensure time allotments correspond to the approximate start and end of each spoken segment. The AI model generating the transcript is responsible for determining these time segments and their natural durations based on the audio.'
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
1.  **Time Allotment & Dialogue Structure (VERY IMPORTANT):**
    *   Segment the audio into logical spoken chunks. For each chunk:
        *   On a new line, provide the time allotment for that chunk, enclosed in square brackets. Use simple, readable formats like "[0 seconds - 15 seconds]", "[25 seconds - 40 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]", or "[2 minutes - 2 minutes 10 seconds]". The AI model determines these time segments.
        *   On the *next* line, provide the speaker label **in bold markdown** (e.g., "**Agent:**", "**User:**", "**Ringing:**", "**Speaker 1:**") followed by the transcribed text for that chunk.
    *   Ensure the time allotments are natural, make sense for the dialogue they precede, and maintain a clear, uncluttered transcript.
2.  **Diarization and Speaker Labels (VERY IMPORTANT - MUST BE BOLD):**
    *   After the time allotment line, the next line must start with the **bolded** speaker label.
    *   If the call begins with audible ringing sounds, **including any automated announcements, IVR (Interactive Voice Response) messages, or distinct pre-recorded voices that play *before* a human agent speaks**, label this entire initial non-human part as "**Ringing:**". For example, if there's an automated "Savdhan agar aapko..." message before the agent, a segment might be:\n      [0 seconds - 8 seconds]\n      **Ringing:** Savdhan agar aapko...
    *   The first *human* speaker who is clearly identifiable as the sales agent (distinguished by their conversational tone, interaction, and content—not by automated announcements or system messages) should be labeled "**Agent:**". This label should *only* be used when the actual human agent definitively starts speaking.
    *   The other primary human speaker (the customer/user) should be labeled "**User:**".
    *   If it's unclear who speaks first (after any ringing/automated messages), or if the initial human speaker is not definitively the agent, use generic labels like "**Speaker 1:**", "**Speaker 2:**", etc., until the Agent and User roles can be clearly assigned.
    *   If, throughout the call, it's impossible to distinguish between Agent and User, consistently use "**Speaker 1:**" and "**Speaker 2:**".
    *   Example segment format:
        \`\`\`
        [45 seconds - 58 seconds]
        **Agent:** How can I help you today?

        [1 minute 0 seconds - 1 minute 12 seconds]
        **User:** I was calling about my bill.
        \`\`\`
3.  **Non-Speech Sounds:** Identify and label any significant non-speech sounds clearly within parentheses (e.g., (Background Sound), (Silence), (Music), (Line Drop)) *within the text portion of the speaker line*, after the **bolded** speaker label. Example:\n    \`[1 minute 20 seconds - 1 minute 25 seconds]\n    **User:** I was calling about (Background Noise) my bill.\`
4.  **Language & Script (CRITICAL & STRICT):**
    *   The entire transcript MUST be in English (Roman script) ONLY.
    *   If Hindi or Hinglish words or phrases are spoken (e.g., "kya", "kaun", "aap kaise hain", "achha theek hai", "ji haan", "savdhan agar aapko"), they MUST be **accurately transliterated** into Roman script.
    *   Do NOT translate these words into English; transliterate them directly and accurately into Roman characters. (e.g., "kya" NOT "what", "savdhan agar aapko" NOT "be careful if you").
    *   Absolutely NO Devanagari script or any other non-Roman script characters are permitted in the output. The entire output MUST be valid Roman script characters.
5.  **Accuracy Assessment (CRITICAL):** After transcription, provide a qualitative assessment of the transcription's accuracy. Strive for the highest possible accuracy given the audio quality.
    *   If accuracy is high, state: "High".
    *   If accuracy is impacted by audio quality, state "Medium" or "Low" and be VERY SPECIFIC about the reasons (e.g., "Medium due to significant background noise and faint speaker voice", "Low due to overlapping speech and poor audio quality throughout the call", "Medium due to presence of loud automated announcements making some initial words unclear").
    *   Do not invent accuracy. Base it purely on the clarity of the provided audio.
6.  **Completeness:** Ensure the transcript is **complete and full**, capturing the entire conversation. Each spoken segment (time allotment + speaker line) should be on its own set of lines. Use double newlines to separate distinct speaker segments if it improves readability.

Prioritize accuracy in transcription, time allotment (ensure brackets), speaker labeling (ensure bolding), and transliteration above all else. Pay close attention to distinguishing pre-recorded system messages from human agent speech.
`,
  config: {
     responseModalities: ['TEXT'],
     temperature: 0.1, // Lower temperature for more factual transcription
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
        console.error("transcriptionFlow: Prompt returned no output (null or undefined). This indicates a failure in the AI model to generate a response. Audio might be too long, corrupted, or the model service is experiencing issues.");
        return {
          diarizedTranscript: "[Transcription Error: The AI model returned no content. This could be due to an issue with the audio file (e.g. too long, silent, corrupted) or a problem with the AI service. Please check the file and try again. If the issue persists, check server logs.]",
          accuracyAssessment: "Error (No AI Output)"
        };
      }
      // Ensure transcript is not empty or just whitespace
      if (!output.diarizedTranscript || output.diarizedTranscript.trim() === "") {
        console.warn("transcriptionFlow: Prompt returned an empty or whitespace-only transcript. This might indicate a silent audio, very short audio, or an issue with the AI model's ability to process this specific audio.");
        return {
          diarizedTranscript: "[AI returned an empty transcript. Audio might be silent, too short, or the model could not process it. Please verify the audio content.]",
          accuracyAssessment: "Low (empty result from AI)"
        };
      }
      // Heuristic check for new time allotment format (brackets)
      if (!output.diarizedTranscript.includes("[") || !output.diarizedTranscript.includes("]")) {
          console.warn("transcriptionFlow: Transcript does not appear to contain bracketed time allotments as expected. Proceeding, but output might be malformed. Transcript (start):", output.diarizedTranscript.substring(0,100));
      }
      // Heuristic check for bold speaker labels
      if (!output.diarizedTranscript.includes("**")) {
          console.warn("transcriptionFlow: Transcript does not appear to contain bolded speaker labels (using '**') as expected. Proceeding, but output might be malformed. Transcript (start):", output.diarizedTranscript.substring(0,100));
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
      } else if (error.message.toLowerCase().includes("safety settings") || error.message.toLowerCase().includes("blocked")){
        clientErrorMessage = `[Transcription Blocked. The content may have been blocked by safety filters or other policy. Check audio content. Original error: ${error.message.substring(0,100)}]`;
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

    