
'use server';
/**
 * @fileOverview Audio transcription flow with a resilient, dual-model fallback system
 * and an exponential backoff retry mechanism to handle API rate limiting and large file sizes.
 * This version uses a simplified prompt to improve reliability for large files.
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
    
    // Use a faster model first, then the more powerful one as a fallback.
    const primaryModel = 'googleai/gemini-2.0-flash'; 
    const fallbackModel = 'googleai/gemini-1.5-flash-latest';
    let output: TranscriptionOutput | undefined;

    // A simpler, more direct prompt to reduce cognitive load on the model for large audio files.
    const transcriptionPromptInstructions = `You are an expert transcriptionist. Your task is to transcribe the provided audio of a conversation between two speakers.

Your output must be a JSON object that strictly conforms to the following schema:
- diarizedTranscript: A string containing the full transcript.
- accuracyAssessment: A string with your estimated accuracy as a percentage (e.g., "95%") and a brief justification.

**TRANSCRIPTION RULES (STRICTLY FOLLOW):**

1.  **Speaker Labels & Time Allotments:** Identify the two main speakers. The output must be structured in segments. Each segment must have:
    - On a new line: The time allotment for that chunk, in square brackets (e.g., "[0 seconds - 15 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]").
    - On the *next* line: The speaker label "AGENT:" or "USER:" followed by their dialogue.
    \`\`\`
    [0 seconds - 15 seconds]
    AGENT: Hello, how can I help you?
    
    [16 seconds - 25 seconds]
    USER: I have a question about my subscription.
    \`\`\`
2.  **Language:** Transcribe the dialogue as spoken. If you hear Hinglish (e.g., "achha theek hai"), transliterate it into Roman script. Do not translate it. The entire output must be in English (Roman script).
3.  **Non-Speech Sounds (CRITICAL):** IGNORE ALL non-dialogue sounds. Do not transcribe ringing, music, hold music, IVR (Interactive Voice Response) prompts, long silences, or system announcements. The transcript should contain ONLY the direct conversation between the two human speakers.

Begin transcription.`;

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
             
             if (!isRateLimitError) {
                console.warn(`Primary model (${primaryModel}) failed with non-quota error. Attempting fallback immediately. Error: ${primaryError.message}.`);
             } else {
                 console.warn(`Primary model (${primaryModel}) failed on attempt ${attempt + 1}. Error: ${primaryError.message}.`);
             }
             
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
                const isFallbackRateLimit = fallbackError.message.includes('429') || fallbackError.message.toLowerCase().includes('quota');

                if (isFallbackRateLimit && attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.warn(`Fallback model also failed with rate limit. Waiting for ${delay}ms before next attempt.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw fallbackError;
                }
             }
        }
    }
    
    if (!output) {
      const clientErrorMessage = `[Transcription Error: All AI models failed to process the request after ${maxRetries} attempts. The audio file may be corrupted, silent, or in an unsupported format, or the service may be persistently unavailable.]`;
      // We throw an error here to let the calling function (like scoreCall) know that transcription failed definitively.
      throw new Error(clientErrorMessage);
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
    // Return a structured error object instead of throwing, so the caller can handle it.
    return {
      diarizedTranscript: `[Critical Transcription System Error. Check server logs. Message: ${error.message?.substring(0,100)}]`,
      accuracyAssessment: "Error"
    };
  }
}

    
