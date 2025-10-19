/* eslint-disable @typescript-eslint/ban-ts-comment */

import {ai} from '@/ai/genkit';
import { TranscriptionInputSchema, TranscriptionOutputSchema } from '@/types';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';
import { resolveGeminiAudioReference } from '@/ai/utils/media';
import { AI_MODELS } from '@/ai/config/models';

export const TRANSCRIPTION_PROMPT: string = `You are an advanced transcription engine designed for ETPrime and Times Health+ call recordings.

### Objective
Transcribe accurately, diarize correctly, and segment chronologically with clear speaker labeling and timestamps.

### Formatting Rules
1. **Segment Structure & Time Allotments**
   - Line 1: Time range in square brackets. Example: "[0 seconds - 15 seconds]" or "[1 minute 5 seconds - 1 minute 20 seconds]".
   - Line 2: Speaker label with profile annotation, followed by dialogue.
     - AGENT (Profile: Company Representative)
     - USER (Profile: Customer / Caller)
   - Example segment:
     ~~~
     [0 seconds - 12 seconds]
     AGENT (Profile: Company Representative): Hello, you’re speaking with Riya from ETPrime renewals. Is this Mr. Sharma?
     ~~~

2. **Speakers**
   - Only two human speakers: AGENT and USER.
   - System prompts (including IVR) tagged as: SYSTEM (Profile: IVR)

3. **Diarization & Timing**
   - Every segment has precise startSeconds and endSeconds.
   - Merge micro-pauses; split only on speaker change.

4. **Redactions**
   - Redact PII (OTP, card numbers, etc.) as "[REDACTED: TYPE]".

5. **Non-speech Events**
   - Use bracketed notes: [background noise], [call dropped], etc.
   - Specifically for IVR: [IVR_VOICE] for automated voice prompts (include transcribed text), [IVR_TUNE] for IVR hold music or tunes.

6. **Language**
   - Preserve spoken language (English/Hinglish). No paraphrasing.

7. **IVR Identification**
   - Correctly identify IVR voices and tunes, profiling them as SYSTEM (Profile: IVR).
   - For automated IVR voices: Use [IVR_VOICE] with transcribed text, e.g., [IVR_VOICE - "Please enter your account number"].
   - For IVR tunes: Use [IVR_TUNE] with description, e.g., [IVR_TUNE - "Classical hold music"].
   - These must NEVER be attributed to AGENT or USER.

### Output JSON Schema
{
  "callMeta": { "sampleRateHz": number | null, "durationSeconds": number | null },
  "segments": [
    {
      "startSeconds": number,
      "endSeconds": number,
      "speaker": "AGENT" | "USER" | "SYSTEM",
      "speakerProfile": string,
      "text": string
    }
  ],
  "summary": {
    "overview": string,
    "keyPoints": string[],
    "actions": string[]
  }
}

### Validation
- Ensure startSeconds < endSeconds
- speaker ∈ {AGENT, USER, SYSTEM}
- For SYSTEM segments, speakerProfile must be "IVR"
- No triple backticks. Use ~~~ for examples.
`;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput): Promise<TranscriptionOutput> => {
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
        console.log(`Attempting transcription with \${modelToUse} (Attempt \${attempt}/\${maxRetries})`);
        
        const { output } = await ai.generate({
          model: modelToUse,
          prompt: [
            { media: audioReference },
            { text: TRANSCRIPTION_PROMPT },
          ],
          output: { schema: TranscriptionOutputSchema, format: 'json' },
          config: { temperature: 0.1 },
        });

        if (!output) {
          throw new Error(`Model \${modelToUse} returned empty output.`);
        }
        
        return output;

      } catch (primaryError: any) {
        console.warn(`Model (\${modelToUse}) failed on attempt \${attempt}. Error: \${JSON.stringify(primaryError, Object.getOwnPropertyNames(primaryError))}`);
        
        const errorMessage = primaryError.message?.toLowerCase() || '';
        const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource has been exhausted');

        if (isRateLimitError && attempt < maxRetries) {
            const waitTime = initialDelay * Math.pow(2, attempt - 1);
            console.log(`Rate limit error on attempt \${attempt}. Waiting for \${waitTime}ms before retrying.`);
            await delay(waitTime);
            continue;
        }
        
        if (attempt >= maxRetries) {
          console.error(`Transcription failed after all \${maxRetries} retries. Last error:`, primaryError);
          throw new Error(`[Critical Transcription System Error. Check server logs. Message: \${primaryError.message}]`);
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
      callMeta: { sampleRateHz: null, durationSeconds: null },
      segments: [],
      summary: {
        overview: `[Critical Transcription System Error. Check server logs. Message: \${error.message?.substring(0,100)}]`,
        keyPoints: [],
        actions: []
      }
    };
  }
}

// Helper function for building system prompt
export function buildTranscriptionSystemPrompt(): string {
  return TRANSCRIPTION_PROMPT;
}
