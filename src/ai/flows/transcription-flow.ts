/* eslint-disable @typescript-eslint/ban-ts-comment */

import {ai} from '@/ai/genkit';
import { TranscriptionInputSchema, TranscriptionOutputSchema } from '@/types';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';
import { resolveGeminiAudioReference } from '@/ai/utils/media';
import { AI_MODELS } from '@/ai/config/models';
import { transcriptionRetryManager } from '@/ai/utils/retry-manager';

export const TRANSCRIPTION_PROMPT: string = `You are an advanced transcription and audio analysis engine designed for ETPrime and Times Health+ call recordings. You must perform BOTH accurate speech transcription AND comprehensive audio environment analysis.

### Objective
1. Transcribe all spoken words with perfect accuracy
2. Perform precise speaker diarization and identification
3. Detect and label ALL non-speech audio events (IVR tones, ringing, hold music, background noise)
4. Maintain chronological segmentation with accurate timestamps
5. Distinguish between human voices and automated systems

### Critical Audio Analysis Requirements

**A. SPEAKER DIARIZATION & IDENTIFICATION**
- Analyze voice characteristics: pitch, tone, gender, accent, speaking style
- Track each unique speaker consistently throughout the call
- Identify speaker names when mentioned in conversation
- Differentiate between:
  * Agent voices (company representatives - typically trained, professional tone)
  * User/Customer voices (callers - varied tone, may sound uncertain or emotional)
  * Multiple agents (Agent 1, Agent 2, etc.)
  * Multiple customers (User Primary, User Secondary, etc.)
- Listen for introductions: "Hi, this is [Name] from [Company]"
- Maintain speaker identity across the entire call

**B. IVR & AUTOMATED SYSTEM DETECTION**
- **IVR Voice Characteristics**: Robotic/synthesized voice, consistent tone, no emotional variation, perfect pronunciation
- **IVR Content Patterns**: 
  * Menu options: "Press 1 for..., Press 2 for..."
  * Confirmation prompts: "Please say yes or no"
  * Authentication requests: "Please enter your account number"
  * Automated greetings: "Thank you for calling [Company]"
  * Queue messages: "Your call is important to us"
  * Hold announcements: "Please stay on the line"
- **Audio Cues**: DTMF tones (beeps from keypad), mechanical voice quality

**C. CALL STATE DETECTION**
- **Ringing/Dialing**: Repetitive ringtone pattern, dial tone, connection sounds
  * Label as: speaker="SYSTEM", speakerProfile="Call Ringing"
  * Text: "[Call ringing - awaiting connection]"

- **Call on Hold**: Hold music, silence with occasional beeps, hold announcements
  * Label as: speaker="SYSTEM", speakerProfile="Call on Hold"
  * Text: "[Call on hold - music playing]" or "[Call on hold - silence]"

- **Busy Signal**: Fast beep pattern indicating line busy
  * Label as: speaker="SYSTEM", speakerProfile="Busy Signal"
  * Text: "[Busy signal detected]"

- **Disconnected/Dead Air**: Prolonged silence with no activity
  * Label as: speaker="SYSTEM", speakerProfile="Dead Air"
  * Text: "[Silence - no active audio]"

**D. BACKGROUND NOISE & ENVIRONMENT ANALYSIS**
- **Identify but don't over-report**: Only create segments for significant background events
- **Background Types**:
  * Office noise: Typing, multiple conversations, printers
  * Call center environment: Cross-talk from other agents
  * Customer environment: TV, children, traffic, outdoor sounds
  * Technical noise: Static, echo, feedback, poor connection
- **When to report**: Only if noise significantly affects call quality or comprehension
- Label as: speaker="SYSTEM", speakerProfile="Background Noise - [Type]"
- Text: "[Background: office chatter]" or "[Background: poor connection quality]"

**E. PRE-CALL & INTERNAL CONVERSATIONS**
- Detect agent-to-agent or internal discussions before customer connects
- Listen for phrases like "I'm connecting you now", "Can you take this call?", whispered discussions
- Label as: speaker="AGENT", speakerProfile="Pre-Call - Agent [Name]"
- Mark clearly to distinguish from customer conversation

### Formatting Rules

1. **Segment Structure**
   - Line 1: Time range in square brackets: "[0 seconds - 15 seconds]" or "[1 minute 5 seconds - 1 minute 20 seconds]"
   - Line 2: Speaker label with detailed profile annotation, followed by dialogue/description
   
   **Examples:**
   ~~~
   [0 seconds - 3 seconds]
   SYSTEM (Call Ringing): [Phone ringing - awaiting answer]
   
   [3 seconds - 8 seconds]
   SYSTEM (IVR): Thank you for calling ETPrime customer service. Please press 1 for subscriptions, press 2 for technical support.
   
   [8 seconds - 10 seconds]
   SYSTEM (IVR): [DTMF tone - button press detected]
   
   [10 seconds - 22 seconds]
   AGENT (Riya): Hello, you're speaking with Riya from the ETPrime renewals team. Am I speaking with Mr. Sharma?
   
   [22 seconds - 26 seconds]
   USER (Mr. Sharma): Yes, this is Sharma speaking. How can I help you?
   
   [26 seconds - 28 seconds]
   SYSTEM (Background Noise - Office): [Brief background chatter from other agents]
   ~~~

2. **Speaker Type Mapping (CRITICAL)**
   - **AGENT**: All company representatives, sales agents, support staff
     * speakerProfile format: "Agent (Name)" or "Agent 1", "Agent 2" if names unknown
   
   - **USER**: All customers, callers, prospects
     * speakerProfile format: "User (Name)" or "User Primary", "User Secondary" for multiple
   
   - **SYSTEM**: ALL non-human audio events
     * IVR/Automated: speakerProfile="IVR" or "IVR - [Company Name]"
     * Ringing: speakerProfile="Call Ringing"
     * Hold: speakerProfile="Call on Hold"
     * Busy: speakerProfile="Busy Signal"
     * Dead Air: speakerProfile="Dead Air"
     * Background: speakerProfile="Background Noise - [Type]"
     * Pre-Call: speakerProfile="Pre-Call - Agent [Name]"
     * DTMF Tones: speakerProfile="DTMF Tone"

3. **Diarization Best Practices**
   - Merge micro-pauses within the same speaker's continuous speech
   - Split segments ONLY when speaker changes or audio event occurs
   - Track voice characteristics to maintain consistent speaker identification
   - If speaker identity changes (discovered later in call), maintain consistency going forward
   - Use precise startSeconds and endSeconds for every segment

4. **Multi-Speaker Scenarios**
   - Conference calls: Label each participant distinctly (Agent 1, Agent 2, User 1, User 2)
   - Transfers: Track when call is transferred and new agents join
   - Background speakers: Only transcribe if relevant to main conversation

5. **Redactions & Privacy**
   - Redact ALL PII: "[REDACTED: OTP]", "[REDACTED: Card Number]", "[REDACTED: SSN]"
   - Redact sensitive data: account numbers, passwords, personal addresses
   - Keep context clear without exposing private information

6. **Language Handling**
   - Transcribe ALL spoken content in English Roman script (Latin alphabet) ONLY
   - **For Hindi/Devanagari/Regional languages**: Provide ONLY Roman script transliteration
   - DO NOT include original Devanagari or other scripts
   - Preserve meaning and natural phrasing
   - Examples:
     * "नमस्ते" → "namaste"
     * "आप कैसे हैं?" → "aap kaise hain?"
     * "धन्यवाद" → "dhanyavaad"
     * Mixed: "Thank you, bahut achha laga" → "Thank you, bahut achha laga"

### Output JSON Schema
{
  "callMeta": {
    "sampleRateHz": number | null,
    "durationSeconds": number | null
  },
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

### Summary Guidelines
- **overview**: Comprehensive summary including call type, participants, IVR interactions, hold times, outcome
- **keyPoints**: Important moments including when IVR was encountered, hold periods, speaker changes, decisions made
- **actions**: Follow-up tasks, commitments made, next steps

### Validation Rules
- startSeconds < endSeconds for all segments
- speaker must be exactly one of: "AGENT", "USER", "SYSTEM"
- speakerProfile must clearly identify the audio source
- SYSTEM segments must have descriptive speakerProfile (IVR, Call Ringing, Hold, Background Noise, etc.)
- All IVR interactions, ringing, hold periods must be captured as SYSTEM segments
- No segment should be skipped - account for entire call duration
- No markdown code blocks in output (no triple backticks)
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
