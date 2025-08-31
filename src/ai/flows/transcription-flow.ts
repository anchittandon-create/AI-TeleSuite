
'use server';
/**
 * @fileOverview Audio transcription flow with a resilient, dual-model fallback system
 * and an exponential backoff retry mechanism to handle API rate limiting.
 */

import {ai} from '@/ai/genkit';
import { TranscriptionInputSchema, TranscriptionOutputSchema } from '@/types';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';


const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput) : Promise<TranscriptionOutput> => {
    
    const primaryModel = 'googleai/gemini-2.0-flash';
    const fallbackModel = 'googleai/gemini-1.5-flash-latest';
    let output: TranscriptionOutput | undefined;

    const transcriptionPromptInstructions = `You are an expert transcriptionist. Your task is to transcribe the provided audio, focusing exclusively on the human dialogue between the two main speakers: the agent and the user.

You must strictly adhere to ALL of the following instructions:

1.  **IGNORE ALL NON-SPEECH SOUNDS:** Do not transcribe, mention, or note any of the following:
    *   Ringing sounds
    *   Automated announcements or IVR (Interactive Voice Response) messages (e.g., "Welcome to our service...", "Savdhan agar aapko...")
    *   Background noise, music, silence, or line drops.
    Your final transcript should be clean and contain **only the dialogue** between the human speakers.

2.  **Diarization and Speaker Labels (CRITICAL - AGENT/USER ONLY):**
    *   Your primary goal is to label the two main human speakers as "AGENT:" and "USER:". Use conversational cues to distinguish them.
        *   **AGENT:** Typically leads the call, asks questions, provides product information.
        *   **USER:** Typically responds, asks for help, provides personal context.
    *   Do not use any other labels like "RINGING:", "SPEAKER 1:", etc. The entire transcript must only contain "AGENT:" and "USER:" labels.

3.  **Time Allotment & Dialogue Structure (VERY IMPORTANT):**
    *   Segment the audio into logical spoken chunks. For each chunk:
        *   On a new line, provide the time allotment. Use a simple format like "[0 seconds - 15 seconds]" or "[1 minute 5 seconds - 1 minute 20 seconds]".
        *   On the *next* line, provide the speaker label ("AGENT:" or "USER:") followed by their transcribed dialogue.
    *   Example segment format:
        \`\`\`
        [45 seconds - 58 seconds]
        AGENT: How can I help you today?

        [1 minute 0 seconds - 1 minute 12 seconds]
        USER: I was calling about my bill.
        \`\`\`

4.  **Language & Script (CRITICAL & NON-NEGOTIABLE):**
    *   The entire output transcript MUST be in **English (Roman script) ONLY**.
    *   If Hindi or Hinglish words or phrases are spoken, they MUST be **accurately transliterated** into Roman script (e.g., "kya", "achha theek hai").
    *   Do NOT translate these words into English. Transliterate them.
    *   **Absolutely NO Devanagari script** or any other non-Roman script characters are permitted.

5.  **Accuracy Assessment (CRITICAL - Specific Percentage Required):**
    *   After transcribing, you MUST provide an **estimated accuracy score as a specific percentage**.
    *   Justify the score based on audio quality (e.g., "98% - Audio was clear and speech was distinct." or "92% - Accuracy was slightly impacted by overlapping speech.").
    *   Provide an exact percentage estimate, not a qualitative range.

6.  **Completeness:** Ensure the transcript is **complete and full**, capturing all dialogue between the agent and user.

Your final output must be a clean, two-person dialogue, free of any background noise or system message transcriptions.
`;

    const maxRetries = 3;
    const initialDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`Attempting transcription with primary model: ${primaryModel} (Attempt ${attempt + 1}/${maxRetries})`);
            const { output: primaryOutput } = await ai.generate({
                model: primaryModel,
                prompt: [{ media: { url: input.audioDataUri } }, { text: transcriptionPromptInstructions }],
                output: { schema: TranscriptionOutputSchema, format: "json" },
                config: { temperature: 0.1, responseModalities: ['TEXT'] }
            });

            if (primaryOutput && primaryOutput.diarizedTranscript && primaryOutput.diarizedTranscript.trim() !== "") {
                output = primaryOutput;
                break; // Success, exit the loop
            }
            throw new Error("Primary model returned an empty or invalid transcript.");

        } catch (primaryError: any) {
             const isRateLimitError = primaryError.message.includes('429') || primaryError.message.toLowerCase().includes('quota');
             
             if (isRateLimitError) {
                 console.warn(`Primary model (${primaryModel}) failed on attempt ${attempt + 1}. Error: ${primaryError.message}.`);
             } else {
                console.warn(`Primary model (${primaryModel}) failed with non-quota error. Attempting fallback immediately. Error: ${primaryError.message}.`);
             }
             
             // If primary fails (for any reason), try fallback immediately within the same attempt
             try {
                console.log(`Attempting transcription with fallback model: ${fallbackModel} (Attempt ${attempt + 1}/${maxRetries})`);
                const { output: fallbackOutput } = await ai.generate({
                    model: fallbackModel,
                    prompt: [{ media: { url: input.audioDataUri } }, { text: transcriptionPromptInstructions }],
                    output: { schema: TranscriptionOutputSchema, format: "json" },
                    config: { temperature: 0.1, responseModalities: ['TEXT'] }
                });

                if (fallbackOutput && fallbackOutput.diarizedTranscript && fallbackOutput.diarizedTranscript.trim() !== "") {
                    output = fallbackOutput;
                    break; // Success with fallback, exit the loop
                }
                throw new Error("Fallback model also returned an empty or invalid transcript.");

             } catch (fallbackError: any) {
                // If fallback also fails, now we check if it's a rate limit error to decide on waiting.
                const isFallbackRateLimit = fallbackError.message.includes('429') || fallbackError.message.toLowerCase().includes('quota');

                if (isFallbackRateLimit && attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.warn(`Fallback model also failed with rate limit. Waiting for ${delay}ms before next attempt.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // If it's not a rate limit error, or it's the last attempt, re-throw the error.
                    throw fallbackError;
                }
             }
        }
    }
    
    // Final check after the loop
    if (!output) {
      const clientErrorMessage = `[Transcription Error: All AI models failed to process the request after ${maxRetries} attempts. The audio file may be corrupted, silent, or in an unsupported format, or the service may be persistently unavailable.]`;
      return {
          diarizedTranscript: clientErrorMessage,
          accuracyAssessment: "Error"
      };
    }
    
    if (!output.diarizedTranscript || !output.diarizedTranscript.includes("[")) {
      console.warn("transcriptionFlow: AI returned a malformed transcript (missing timestamps).", output);
      return {
        diarizedTranscript: `[Transcription Error: The AI model returned an invalid or malformed transcript. This could be due to a silent or corrupted audio file. Response: ${JSON.stringify(output).substring(0,100)}...]`,
        accuracyAssessment: "Error"
      };
    }
    
    return output;
  }
);

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  try {
    return await transcriptionFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling transcriptionFlow from export function:", error);
    return {
      diarizedTranscript: `[Critical Transcription System Error. Check server logs. Message: ${error.message?.substring(0,100)}]`,
      accuracyAssessment: "System Error"
    };
  }
}
