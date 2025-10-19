
'use server';
/**
 * @fileOverview Audio transcription flow with a resilient, dual-model fallback system
 * and an exponential backoff retry mechanism to handle API rate limiting and large file sizes.
 */

import {ai} from '@/ai/genkit';
import { TranscriptionInputSchema, TranscriptionOutputSchema } from '@/types';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';
import { resolveGeminiAudioReference } from '@/ai/utils/media';
import { AI_MODELS } from '@/ai/config/models';

function ensureSpeakerLabels(transcript: string): void {
  const hasAgentLabel = /(^|\n)\s*AGENT\s*(?:\([^)]*\))?\s*:/.test(transcript);
  const hasUserLabel = /(^|\n)\s*USER\s*(?:\([^)]*\))?\s*:/.test(transcript);

  if (!hasAgentLabel || !hasUserLabel) {
    throw new Error('Transcript missing AGENT/USER speaker attribution.');
  }

  const unexpectedLabels = new Set<string>();
  const lines = transcript.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('[')) {
      continue; // timestamps, event tags, or blank lines
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue; // continuation of dialogue or descriptive text
    }

    const labelSection = line.slice(0, colonIndex).trim();
    const normalizedLabel = labelSection
      .replace(/\s*\([^)]*\)\s*$/, '')
      .toUpperCase();

    if (normalizedLabel && !['AGENT', 'USER'].includes(normalizedLabel)) {
      unexpectedLabels.add(labelSection);
    }
  }

  if (unexpectedLabels.size > 0) {
    throw new Error(
      `Unexpected speaker labels detected: ${Array.from(unexpectedLabels).join(', ')}`
    );
  }
}


const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput) : Promise<TranscriptionOutput> => {
    
    // Use a faster model first, then the more powerful one as a fallback.
    const primaryModel = AI_MODELS.MULTIMODAL_PRIMARY; 
    const fallbackModel = AI_MODELS.MULTIMODAL_SECONDARY;
    let output: TranscriptionOutput | undefined;

    const transcriptionPromptInstructions = `You are an expert transcriptionist. Your task is to transcribe the provided audio of a conversation that can include a live agent, a customer, IVR menus, ringing, or hold music.

Your output must be a JSON object that strictly conforms to the following schema:
- diarizedTranscript: A string containing the full transcript.
- accuracyAssessment: A string with your estimated accuracy as a percentage (e.g., "95%") and a brief justification.

**TRANSCRIPTION RULES (STRICTLY FOLLOW):**

1.  **Segment Structure & Time Allotments:** Structure the transcript in chronological segments. Each segment must include:
    - Line 1: The time allotment in square brackets (e.g., "[0 seconds - 15 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]").
    - Line 2: The speaker label **with a profile annotation** followed by a colon and their dialogue. Only two human speaker labels are permitted:
        - \`AGENT (Profile: Company Representative ...):\`
        - \`USER (Profile: Customer / Caller ...):\`
    - Example segment:
    \`\`\`
    [0 seconds - 12 seconds]
    AGENT (Profile: Company Representative - Name Mentioned: Alex): Hello, thank you for calling. How may I help you today?

    [12 seconds - 21 seconds]
    USER (Profile: Customer / Caller): Hi Alex, I'm following up about my subscription renewal.
    \`\`\`
    Use the most specific descriptor you can confidently infer from the audio. If unsure, fall back to "Company Representative" for the agent and "Customer / Caller" for the user. If the agent states their name, append it inside the profile description ("Name Mentioned: …").
2.  **Language:** Transcribe dialogue exactly as spoken. Hinglish must be transliterated into Roman script (e.g., "achha theek hai"). Do not translate into English. The entire output must remain in Roman script only.
3.  **System & Non-Human Audio Events:** Clearly differentiate IVR menus, ringing, hold music, silence, or any other non-human audio. Within the appropriate time block, add a separate line containing one of these tags (no colon afterwards): [RINGING], [IVR_PROMPT], [IVR_MENU], [HOLD_TONE], [MUSIC], [SILENCE]. You may append a short description after a hyphen if helpful, e.g., "[IVR_PROMPT] - \"Press 1 for sales\"". These events must NEVER be attributed to AGENT or USER.
4.  **Dialogue Attribution Discipline:** Only human dialogue may appear under AGENT or USER labels. Do not introduce any additional speaker labels. Never assign IVR prompts, hold music, background announcements, or silence to the agent or the user. If a genuinely distinct third-party human voice is heard, describe it inside a bracketed note within the relevant AGENT/USER segment (e.g., "[THIRD_PARTY: Technician confirms the serial number]").
5.  **Audio Quality Handling:** Ignore background noise, keyboard clicks, and non-speech artifacts. If speech is unintelligible, insert "[INAUDIBLE]" at the appropriate place in the dialogue line while retaining the correct speaker and profile annotation.

Begin transcription.`;

    const maxRetries = 3;
    const initialDelay = 2000; // 2 seconds

    const audioMedia = await resolveGeminiAudioReference(input.audioDataUri, {
      displayName: 'transcription-audio',
    });
    const audioPromptPart = audioMedia.contentType
      ? { media: { url: audioMedia.url, contentType: audioMedia.contentType } }
      : { media: { url: audioMedia.url } };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`Attempting transcription with primary model: ${primaryModel} (Attempt ${attempt + 1}/${maxRetries})`);
            const { output: primaryOutput } = await ai.generate({
                model: primaryModel,
                prompt: [audioPromptPart, { text: transcriptionPromptInstructions }],
                output: { schema: TranscriptionOutputSchema, format: "json" },
                config: { temperature: 0.1, responseModalities: ['TEXT'] }
            });

            if (primaryOutput && primaryOutput.diarizedTranscript && primaryOutput.diarizedTranscript.trim() !== "") {
                ensureSpeakerLabels(primaryOutput.diarizedTranscript);
                output = primaryOutput;
                break; // Success, exit the loop
            }
            throw new Error("Primary model returned an empty or invalid transcript.");

        } catch (primaryError: any) {
             const isRateLimitError = primaryError.message.includes('429') || primaryError.message.toLowerCase().includes('quota');
             
             if (!isRateLimitError) {
                console.warn(`Primary model (${primaryModel}) failed with non-quota error. Attempting fallback immediately. Error: ${JSON.stringify(primaryError, Object.getOwnPropertyNames(primaryError))}`);
             } else {
                 console.warn(`Primary model (${primaryModel}) failed on attempt ${attempt + 1}. Error: ${primaryError.message}.`);
             }
             
             try {
                console.log(`Attempting transcription with fallback model: ${fallbackModel} (Attempt ${attempt + 1}/${maxRetries})`);
                const { output: fallbackOutput } = await ai.generate({
                    model: fallbackModel,
                    prompt: [audioPromptPart, { text: transcriptionPromptInstructions }],
                    output: { schema: TranscriptionOutputSchema, format: "json" },
                    config: { temperature: 0.1, responseModalities: ['TEXT'] }
                });

                if (fallbackOutput && fallbackOutput.diarizedTranscript && fallbackOutput.diarizedTranscript.trim() !== "") {
                    ensureSpeakerLabels(fallbackOutput.diarizedTranscript);
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
