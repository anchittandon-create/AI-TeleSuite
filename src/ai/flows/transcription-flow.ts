/* eslint-disable @typescript-eslint/ban-ts-comment */

import {ai} from '@/ai/genkit';
import { TranscriptionInputSchema, TranscriptionOutputSchema } from '@/types';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';
import { resolveGeminiAudioReference } from '@/ai/utils/media';
import { AI_MODELS } from '@/ai/config/models';
import { transcriptionRetryManager } from '@/ai/utils/retry-manager';

export const TRANSCRIPTION_PROMPT: string = `You are an advanced transcription engine designed for ETPrime and Times Health+ call recordings.

### Objective
Transcribe accurately, diarize correctly, and segment chronologically with clear speaker labeling and timestamps.

### Formatting Rules
1. **Segment Structure & Time Allotments**
   - Line 1: Time range in square brackets. Example: "[0 seconds - 15 seconds]" or "[1 minute 5 seconds - 1 minute 20 seconds]".
   - Line 2: Speaker label with profile annotation, followed by dialogue.
     - Agent (Name): For company representatives
     - User (Name): For customers/callers
     - IVR: For automated IVR voices
     - Call Ringing: For call ringing sounds
     - Call on Hold: For hold music or hold announcements
     - Background Noise: For background noise, music, or ambient sounds not part of conversation
     - Pre-Call: For agent-to-agent conversations before customer connects
   - Example segment:
     ~~~
     [0 seconds - 12 seconds]
     Agent (Riya): Hello, you're speaking with Riya from ETPrime renewals. Is this Mr. Sharma?
     ~~~

2. **Speakers & Voice Differentiation**
   - **Agent (Name)**: Company representatives, sales agents, support staff - identify name when mentioned
   - **User (Name)**: Customers, callers, prospects - identify name when mentioned
   - **IVR**: Automated IVR voices and prompts
   - **Call Ringing**: Ringing sounds before call connects
   - **Call on Hold**: Hold music, announcements, or silence during hold
   - **Background Noise**: Ambient sounds, music, noise not part of active conversation
   - **Pre-Call**: Conversations between agents before customer call starts

3. **Diarization & Timing**
   - Every segment has precise startSeconds and endSeconds.
   - Merge micro-pauses; split only on speaker change.
   - Identify speaker names when mentioned (e.g., "Hello, this is John from ETPrime" → Agent (John))
   - Accurately differentiate between customer voice, agent voice, and all other sounds
   - Do not include background noise in main transcript unless it's significant; label appropriately

4. **Special Voice Types**
   - **IVR**: Label automated prompts, menus, confirmations
   - **Call Ringing**: Phone ringing before answer
   - **Call on Hold**: Music, announcements, or silence when call is on hold
   - **Background Noise**: Music, ambient noise, typing, etc. - minimize inclusion or label clearly
   - **Pre-Call**: Agent discussions before customer connects - label as Pre-Call
   - **Multiple Customers**: If multiple customers, use User (Primary), User (Secondary), etc.

5. **Redactions**
   - Redact PII (OTP, card numbers, etc.) as "[REDACTED: TYPE]".

6. **Language**
   - Transcribe all spoken content in English Roman script (Latin alphabet) only.
   - **For Hindi/Devanagari dialogues**: Provide only the Roman script (English alphabet) transliteration. Do not include the original Devanagari text.
   - Preserve spoken language meaning but convert all scripts to Roman alphabet.
   - Example: "नमस्ते, आप कैसे हैं?" should be transcribed as "namaste, aap kaise hain?"

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
- For SYSTEM segments, speakerProfile indicates the type (IVR, Pre-call, Background, etc.)
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

    // Use the robust retry manager that will keep trying until success
    return await transcriptionRetryManager.execute(async () => {
      const primaryModel = AI_MODELS.MULTIMODAL_PRIMARY;
      const fallbackModel = AI_MODELS.MULTIMODAL_SECONDARY;

      // Try primary model first
      try {
        console.log(`Attempting transcription with primary model: ${primaryModel}`);

        const { output } = await ai.generate({
          model: primaryModel,
          prompt: [
            { media: audioReference },
            { text: TRANSCRIPTION_PROMPT },
          ],
          output: { schema: TranscriptionOutputSchema, format: 'json' },
          config: { temperature: 0.1 },
        });

        if (!output) {
          throw new Error(`Primary model ${primaryModel} returned empty output.`);
        }

        return output;

      } catch (primaryError: any) {
        console.warn(`Primary model (${primaryModel}) failed. Trying fallback model: ${fallbackModel}`);

        // Try fallback model
        try {
          const { output } = await ai.generate({
            model: fallbackModel,
            prompt: [
              { media: audioReference },
              { text: TRANSCRIPTION_PROMPT },
            ],
            output: { schema: TranscriptionOutputSchema, format: 'json' },
            config: { temperature: 0.1 },
          });

          if (!output) {
            throw new Error(`Fallback model ${fallbackModel} also returned empty output.`);
          }

          return output;

        } catch (fallbackError: any) {
          // Both models failed, let the retry manager handle it
          const combinedError = new Error(`Both primary and fallback models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
          (combinedError as any).originalErrors = { primary: primaryError, fallback: fallbackError };
          throw combinedError;
        }
      }
    }, 'transcription');
  }
);

export async function transcribeAudio(input: TranscriptionInput): Promise<TranscriptionOutput> {
  // The retry manager ensures this will never fail - it will keep trying until success
  return await transcriptionFlow(input);
}

// Helper function for building system prompt
export function buildTranscriptionSystemPrompt(): string {
  return TRANSCRIPTION_PROMPT;
}
