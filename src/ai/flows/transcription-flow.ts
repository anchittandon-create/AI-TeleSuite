
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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
    
    const transcriptionPromptLines = [
      'You are an expert transcriptionist. Your task is to transcribe the provided audio of a conversation that can include a live agent, a customer, IVR menus, ringing, pre-call answers, or hold music.',
      '',
      'Your output must be a JSON object that strictly conforms to the following schema:',
      '- diarizedTranscript: A string containing the full transcript.',
      '- accuracyAssessment: A string with your estimated accuracy as a percentage (e.g., "95%") and a brief justification.',
      '',
      '**TRANSCRIPTION RULES (STRICTLY FOLLOW):**',
      '',
      '1.  **Segment Structure & Time Allotments:** Structure the transcript in chronological segments. Each segment must include:',
      '    - Line 1: The time allotment in square brackets (e.g., "[0 seconds - 15 seconds]", "[1 minute 5 seconds - 1 minute 20 seconds]").',
      '    - Line 2: The speaker label **with a profile annotation** followed by a colon and their dialogue. Only two human speaker labels are permitted:',
      '        - `AGENT (Profile: Company Representative ...):`',
      '        - `USER (Profile: Customer / Caller ...):`',
      '    - Example segment:',
      '      ```',
      '      [0 seconds - 12 seconds]',
      '      AGENT (Profile: Company Representative - Name Mentioned: Alex): Hello, thank you for calling. How may I help you today?',
      '',
      '      [12 seconds - 21 seconds]',
      '      USER (Profile: Customer / Caller): Hi Alex, I\'m following up about my subscription renewal.',
      '      ```',
      '    Use the most specific descriptor you can confidently infer from the audio. If unsure, fall back to "Company Representative" for the agent and "Customer / Caller" for the user. If the agent states their name, append it inside the profile description ("Name Mentioned: …").',
      '2.  **Language:** Transcribe dialogue exactly as spoken. Hinglish must be transliterated into Roman script (e.g., "achha theek hai"). Do not translate into English. The entire output must remain in Roman script only.',
      '3.  **Pre-Call Answer Handling:** If the call opens with an automated carrier/IVR pickup, ringback, or any "pre-call answer" audio before a live agent speaks, represent it as a standalone system event line using the tag [PRECALL_ANSWER]. Include a short descriptive snippet after a hyphen when helpful (e.g., "[PRECALL_ANSWER] - "Please hold while we connect you""). Never label these clips as AGENT or USER dialogue.',
      '4.  **System & Non-Human Audio Events:** Clearly differentiate IVR menus, ringing, hold music, silence, or any other non-human audio. Within the appropriate time block, add a separate line containing one of these tags (no colon afterwards): [PRECALL_ANSWER], [RINGING], [IVR_PROMPT], [IVR_MENU], [HOLD_TONE], [MUSIC], [SILENCE]. You may append a short description after a hyphen when helpful. These events must NEVER be attributed to AGENT or USER.',
      '5.  **Profile Annotation Discipline:** Only human dialogue may appear under AGENT or USER labels. Use the profile annotation to capture each reliable detail you hear (e.g., "Company Representative - Name Mentioned: Priya Malhotra - Role: Billing Specialist"). If specifics are unknown, keep the profile concise ("Company Representative"). Do not invent information.',
      '6.  **Audio Quality Handling:** Ignore background noise, keyboard clicks, and non-speech artifacts. If speech is unintelligible, insert "[INAUDIBLE]" at the appropriate place in the dialogue line while retaining the correct speaker and profile annotation.',
      '',
      'Begin transcription.'
    ];
    const transcriptionPrompt = transcriptionPromptLines.join('\\n');

    // If an audio URL is provided, use it directly. Otherwise, fall back to the data URI.
    const audioReference = input.audioUrl 
      ? { url: input.audioUrl }
      : await resolveGeminiAudioReference(input.audioDataUri!, { displayName: 'transcription-audio' });

    if (!audioReference) {
      throw new Error("Could not resolve audio reference from either URL or data URI.");
    }

    const primaryModel = AI_MODELS.MULTIMODAL_PRIMARY;
    const fallbackModel = AI_MODELS.MULTIMODAL_SECONDARY;
    const maxRetries = 2;
    const initialDelay = 1500;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const modelToUse = attempt === 1 ? primaryModel : fallbackModel;
      try {
        console.log(`Attempting transcription with ${modelToUse} (Attempt ${attempt}/${maxRetries})`);
        
        const { output } = await ai.generate({
          model: modelToUse,
          prompt: [
            { media: audioReference },
            { text: transcriptionPrompt },
          ],
          output: { schema: TranscriptionOutputSchema, format: 'json' },
          config: { temperature: 0.1 },
        });

        if (!output) {
          throw new Error(`Model ${modelToUse} returned empty output.`);
        }
        
        return output;

      } catch (primaryError: any) {
        console.warn(`Model (${modelToUse}) failed on attempt ${attempt}. Error: ${JSON.stringify(primaryError, Object.getOwnPropertyNames(primaryError))}`);
        
        const errorMessage = primaryError.message?.toLowerCase() || '';
        const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource has been exhausted');

        if (isRateLimitError && attempt < maxRetries) {
            const waitTime = initialDelay * Math.pow(2, attempt - 1);
            console.log(`Rate limit error on attempt ${attempt}. Waiting for ${waitTime}ms before retrying.`);
            await delay(waitTime);
            continue;
        }
        
        if (attempt >= maxRetries) {
          console.error(`Transcription failed after all ${maxRetries} retries. Last error:`, primaryError);
          throw new Error(`[Critical Transcription System Error. Check server logs. Message: ${primaryError.message}]`);
        }
      }
    }

    // This part should be unreachable if the loop logic is correct, but as a safeguard:
    throw new Error("[Critical Transcription System Error. All attempts failed.]");
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
