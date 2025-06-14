
'use server';
/**
 * @fileOverview Audio transcription flow with speaker diarization, time allotments, and accuracy assessment.
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscriptionInput - The input type for the transcribeAudio function.
 * - TranscriptionOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit/zod';

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
    'The **complete and full** textual transcript of the audio, formatted as a script. Each dialogue segment MUST be structured as follows:\n1. On a new line: The time allotment for that chunk, enclosed in square brackets (e.g., "[0 seconds - 15 seconds]", "[25 seconds - 40 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]"). The AI model determines these time segments based on the audio.\n2. On the *next* line: The speaker label in ALL CAPS (e.g., "AGENT:", "USER:", "RINGING:") followed by the transcribed text for that chunk.\nExample segment:\n[0 seconds - 12 seconds]\nRINGING: Welcome to our service. Please hold while we connect you.\n\n[15 seconds - 28 seconds]\nAGENT: Hello, thank you for calling. This is Alex, how can I help you today?\n\nCritical Diarization Rules for Speaker Labels (must be in ALL CAPS):\n1. If the call begins with audible ringing sounds, **including any automated announcements, IVR messages, or distinct pre-recorded voices that play *before* a human agent speaks**, label this entire initial non-human part as "RINGING:".\n2. The first *human* speaker who is clearly identifiable as the sales agent (distinguished by their conversational tone, typical introductory phrases like "Thank you for calling...", "This is [Agent Name]...", or content that indicates they are representing the company) should be labeled "AGENT:". Strive to identify the AGENT role early if these cues are present.\n3. The other primary human speaker (the customer/user, often the one asking questions, stating problems, or responding to the agent) should be labeled "USER:".\n4. If, after any "RINGING:" segments, it is genuinely impossible to immediately distinguish between Agent and User based on the initial utterances (e.g., both speakers start with very generic phrases, or audio quality is very poor), use generic labels like "SPEAKER 1:", "SPEAKER 2:", etc. However, actively listen for cues throughout the conversation that might later clarify their roles and switch to AGENT/USER if roles become clear.\n5. If roles remain ambiguous throughout the entire call, consistently use "SPEAKER 1:" and "SPEAKER 2:".\n6. Clearly label any significant non-speech sounds within parentheses (e.g., (Background Sound), (Silence), (Music), (Line Drop)) *within the text portion of the speaker line*, after the ALL CAPS speaker label.\n\nCritical Language & Script Rules (STRICT):\n1.  The entire transcript MUST be in English (Roman script) ONLY.\n2.  If Hindi or Hinglish words or phrases are spoken, they MUST be accurately transliterated into Roman script (e.g., "kya" for क्या, "kaun" for कौन, "aap kaise hain" NOT "आप कैसे हैं", "achha theek hai" NOT "अच्छा ठीक है", "savdhan agar aapko" for "सावधान अगर आपको").\n3.  Do NOT translate these words into English; transliterate them directly into Roman characters.\n4.  Absolutely NO Devanagari script or any other non-Roman script characters are permitted in the output. The entire output must be valid Roman script.\n\nTime Allotment Accuracy: Ensure time allotments correspond to the approximate start and end of each spoken segment. The AI model generating the transcript is responsible for determining these time segments and their natural durations based on the audio.'
  ),
  accuracyAssessment: z.string().describe(
    "Your qualitative assessment of the transcript's accuracy. Strive for the highest accuracy possible. If the audio is clear and transcription is excellent (approximating 95%+ accuracy), state 'High'. If audio quality (noise, faintness, overlap) noticeably impacts accuracy, state 'Medium' and briefly note the reason (e.g., 'Medium due to background noise'). If accuracy is significantly compromised, state 'Low' and explain (e.g., 'Low due to poor audio and overlapping speech')."
  ),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;

const transcriptionModelName = 'googleai/gemini-2.0-flash';

const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput) : Promise<TranscriptionOutput> => {
    try {
      const transcriptionPromptInstructions = `Transcribe the audio provided. Strictly adhere to ALL of the following instructions:
1.  **Time Allotment & Dialogue Structure (VERY IMPORTANT):**
    *   Segment the audio into logical spoken chunks. For each chunk:
        *   On a new line, provide the time allotment for that chunk, enclosed in square brackets. Use simple, readable formats like "[0 seconds - 15 seconds]", "[25 seconds - 40 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]", or "[2 minutes - 2 minutes 10 seconds]". The AI model determines these time segments.
        *   On the *next* line, provide the speaker label IN ALL CAPS (e.g., "AGENT:", "USER:", "RINGING:", "SPEAKER 1:") followed by the transcribed text for that chunk.
    *   Ensure the time allotments are natural, make sense for the dialogue they precede, and maintain a clear, uncluttered transcript.
2.  **Diarization and Speaker Labels (VERY IMPORTANT - MUST BE IN ALL CAPS):**
    *   After the time allotment line, the next line must start with the ALL CAPS speaker label.
    *   **"RINGING:" Label:** If the call begins with audible ringing sounds, **including any automated announcements, IVR (Interactive Voice Response) messages, or distinct pre-recorded voices that play *before* a human agent speaks**, label this entire initial non-human part as "RINGING:". For example, if there's an automated "Savdhan agar aapko..." message before the agent, a segment might be:\n      [0 seconds - 8 seconds]\n      RINGING: Savdhan agar aapko...
    *   **"AGENT:" Label:** The first *human* speaker who is clearly identifiable as the sales agent should be labeled "AGENT:". Actively look for cues:
        *   **Typical agent introductions:** "Thank you for calling [Company Name]...", "This is [Agent Name], how may I help you?", "My name is..."
        *   **Controlling the conversation flow:** Asking clarifying questions, providing information, offering solutions.
        *   **Professional tone:** Even if subtle, a more formal or structured tone compared to the other speaker.
        *   This label should *only* be used when the actual human agent definitively starts speaking and their role is clear from content and conversational dynamics.
    *   **"USER:" Label:** The other primary human speaker (the customer/user) should be labeled "USER:". Look for cues:
        *   **Stating a need or problem:** "I'm calling about...", "I have an issue with..."
        *   **Responding to agent's questions.**
        *   **More informal or varied tone.**
    *   **Inference Priority:** Prioritize identifying "AGENT:" and "USER:" based on these conversational dynamics and content cues. Analyze the entire dialogue, not just isolated sentences, to infer roles. If there's a clear indication of who the company representative is versus the caller, use AGENT/USER.
    *   **"SPEAKER 1:", "SPEAKER 2:" Fallback:** If, after any "RINGING:" segments, it is genuinely impossible to immediately distinguish between Agent and User based on the initial utterances (e.g., both speakers start with very generic phrases, or audio quality is very poor making content-based inference hard), use generic labels like "SPEAKER 1:", "SPEAKER 2:". However, continue to analyze the dialogue. If roles become clearer later in the conversation, switch to "AGENT:" and "USER:" for subsequent segments from that speaker.
    *   **Consistent Ambiguity:** If roles remain ambiguous throughout the entire call, consistently use "SPEAKER 1:" and "SPEAKER 2:".
    *   Example segment format:
        \`\`\`
        [45 seconds - 58 seconds]
        AGENT: How can I help you today?

        [1 minute 0 seconds - 1 minute 12 seconds]
        USER: I was calling about my bill.
        \`\`\`
3.  **Non-Speech Sounds:** Identify and label any significant non-speech sounds clearly within parentheses (e.g., (Background Sound), (Silence), (Music), (Line Drop)) *within the text portion of the speaker line*, after the ALL CAPS speaker label. Example:\n    \`[1 minute 20 seconds - 1 minute 25 seconds]\n    USER: I was calling about (Background Noise) my bill.\`
4.  **Language & Script (CRITICAL & STRICT):**
    *   The entire transcript MUST be in English (Roman script) ONLY.
    *   If Hindi or Hinglish words or phrases are spoken (e.g., "kya", "kaun", "aap kaise hain", "achha theek hai", "ji haan", "savdhan agar aapko"), they MUST be **accurately transliterated** into Roman script.
    *   Do NOT translate these words into English; transliterate them directly and accurately into Roman characters. (e.g., "kya" NOT "what", "savdhan agar aapko" NOT "be careful if you").
    *   Absolutely NO Devanagari script or any other non-Roman script characters are permitted in the output. The entire output MUST be valid Roman script characters.
5.  **Accuracy Assessment (CRITICAL - Reflects Your Transcription Quality):**
    *   Your primary goal is to achieve the highest possible transcription accuracy.
    *   If the audio quality is good and you are highly confident in the accuracy of your transcription (approximating 95%+ accuracy with minimal errors), provide the assessment: "High".
    *   If the audio quality (e.g., background noise, faint speaker voices, overlapping speech) noticeably impacts your ability to transcribe with high confidence, provide the assessment: "Medium due to [specific reason, e.g., background noise and faint speaker voice]".
    *   If the audio quality is very poor and significantly compromises the transcription accuracy, provide the assessment: "Low due to [specific reason, e.g., severe overlapping speech and poor audio quality throughout the call]".
    *   Be honest and specific in your assessment; it should reflect the actual quality of the transcript you are producing.
6.  **Completeness:** Ensure the transcript is **complete and full**, capturing the entire conversation. Each spoken segment (time allotment + speaker line) should be on its own set of lines. Use double newlines to separate distinct speaker segments if it improves readability.

Prioritize extreme accuracy in transcription, time allotment (ensure brackets), speaker labeling (ensure ALL CAPS and infer roles diligently), and transliteration above all else. Pay close attention to distinguishing pre-recorded system messages from human agent speech. The quality of your output is paramount.
`;

      const { output } = await ai.generate({
        model: transcriptionModelName,
        prompt: [
          { media: { url: input.audioDataUri } },
          { text: transcriptionPromptInstructions }
        ],
        output: { schema: TranscriptionOutputSchema, format: "json" },
        config: {
          temperature: 0.1,
          responseModalities: ['TEXT'], // Explicitly state we only expect text, though model might change
        }
      });

      if (!output) {
        console.error("transcriptionFlow: ai.generate returned no output. Audio might be too long, corrupted, or the model service is experiencing issues.");
        return {
          diarizedTranscript: "[Transcription Error: The AI model returned no content. This could be due to an issue with the audio file (e.g. too long, silent, corrupted) or a problem with the AI service. Please check the file and try again. If the issue persists, check server logs.]",
          accuracyAssessment: "Error (No AI Output)"
        };
      }
      if (!output.diarizedTranscript || output.diarizedTranscript.trim() === "") {
        console.warn("transcriptionFlow: ai.generate returned an empty or whitespace-only transcript. This might indicate a silent audio, very short audio, or an issue with the AI model's ability to process this specific audio.");
        return {
          diarizedTranscript: "[AI returned an empty transcript. Audio might be silent, too short, or the model could not process it. Please verify the audio content.]",
          accuracyAssessment: "Low (empty result from AI)"
        };
      }
      if (!output.diarizedTranscript.includes("[") || !output.diarizedTranscript.includes("]")) {
          console.warn("transcriptionFlow: Transcript does not appear to contain bracketed time allotments as expected. Proceeding, but output might be malformed. Transcript (start):", output.diarizedTranscript.substring(0,100));
      }
      
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in transcriptionFlow (awaiting ai.generate):", error);
      
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
