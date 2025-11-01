/* eslint-disable @typescript-eslint/ban-ts-comment */

import {ai} from '@/ai/genkit';
import { TranscriptionInputSchema, TranscriptionOutputSchema } from '@/types';
import type { TranscriptionInput, TranscriptionOutput } from '@/types';
import { resolveGeminiAudioReference } from '@/ai/utils/media';
import { AI_MODELS } from '@/ai/config/models';
import { transcriptionRetryManager } from '@/ai/utils/retry-manager';

export const TRANSCRIPTION_PROMPT: string = `You are an advanced transcription and audio analysis engine designed for ETPrime and Times Health+ call recordings. You must perform BOTH accurate speech transcription AND comprehensive audio environment analysis.

### ⚠️ CRITICAL REQUIREMENT - ABSOLUTE RULE - NO EXCEPTIONS ⚠️

**ENGLISH ROMAN ALPHABET ONLY - THIS IS MANDATORY:**
- You MUST use ONLY the English Roman alphabet (A-Z, a-z) for ALL transcription
- NEVER use Devanagari script (Hindi: अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग etc.)
- NEVER use Tamil script (அ ஆ இ ஈ உ ஊ etc.)
- NEVER use Telugu script (అ ఆ ఇ ఈ ఉ ఊ etc.)
- NEVER use Bengali script (অ আ ই ঈ উ ঊ etc.)
- NEVER use any non-Latin scripts whatsoever
- If you see ANY non-Roman characters in your output, you MUST delete them and rewrite in Roman script
- This rule supersedes ALL other instructions

**ROMAN SCRIPT TRANSLITERATION - REQUIRED FOR ALL LANGUAGES:**
- Hindi spoken: "नमस्ते" → You write: "namaste" (NOT the Devanagari)
- Hindi spoken: "मैं ठीक हूं" → You write: "main theek hoon" (NOT Devanagari)
- Hindi spoken: "आप कैसे हैं?" → You write: "aap kaise hain?" (NOT Devanagari)
- Hinglish spoken: "मुझे help चाहिए" → You write: "mujhe help chahiye" (NOT Devanagari)
- Tamil spoken: "வணக்கம்" → You write: "vanakkam" (NOT Tamil script)
- Telugu spoken: "నమస్కారం" → You write: "namaskaram" (NOT Telugu script)

**EXAMPLES OF WHAT TO DO:**
✅ CORRECT: "Hello, main Riya bol rahi hoon ETPrime se"
✅ CORRECT: "Aap ka subscription renew hone wala hai"
✅ CORRECT: "Bahut achha, dhanyavaad"
✅ CORRECT: "Haan, theek hai, main interested hoon"

**EXAMPLES OF WHAT NOT TO DO:**
❌ WRONG: "Hello, मैं Riya बोल रही हूं ETPrime से" (contains Devanagari)
❌ WRONG: "आप का subscription renew होने वाला है" (contains Devanagari)
❌ WRONG: "बहुत अच्छा, धन्यवाद" (all Devanagari)
❌ WRONG: Any output with non-Roman characters

**VALIDATION CHECK:**
Before finalizing your output, scan every single character. If you find ANY character that is not:
- English letters (A-Z, a-z)
- Numbers (0-9)
- Common punctuation (. , ! ? : ; ' " - ...)
- Square brackets for timestamps/events
Then DELETE that character and rewrite it using Roman alphabet transliteration.

### CRITICAL TRANSCRIPTION RULES - ABSOLUTE REQUIREMENTS

**VERBATIM TRANSCRIPTION (NON-NEGOTIABLE):**
- Transcribe EXACTLY what is spoken, word-for-word, with NO paraphrasing
- Include ALL words: filler words (um, uh, like, you know), repetitions, false starts, stutters
- Capture EVERY spoken word - do NOT summarize, condense, or clean up the dialogue
- Maintain natural speech patterns including grammatical errors as spoken
- If speaker says "umm... so... like... I think maybe we can...", transcribe EXACTLY that
- DO NOT convert spoken language to formal written language
- DO NOT correct grammar or sentence structure
- Example: If spoken is "I'm... uh... I'm calling about the... you know... the subscription thing"
  → Transcribe: "I'm... uh... I'm calling about the... you know... the subscription thing"
  → DO NOT: "I'm calling about the subscription"

### Objective
1. Transcribe all spoken words with PERFECT VERBATIM accuracy - every single word as spoken
2. Perform precise speaker diarization and identification
3. Detect and label ALL non-speech audio events (IVR tones, ringing, hold music, background noise)
4. Maintain chronological segmentation with accurate timestamps
5. Distinguish between human voices and automated systems
6. ALWAYS output in English Roman script ONLY - no exceptions

### Critical Audio Analysis Requirements

**A. SPEAKER DIARIZATION & IDENTIFICATION - CRITICAL FOR ACCURATE ATTRIBUTION**

**Voice Profiling Protocol (MUST FOLLOW)**:

1. **Initial Voice Analysis** (First 5 seconds of each speaker):
   - **Pitch Range**: Measure fundamental frequency
     * Agent voices: Often trained to mid-range pitch (professional, clear)
     * Customer voices: Natural variation (may be higher when stressed/excited, lower when calm)
   - **Tone Quality**: 
     * Agent: Consistent, controlled, professional modulation
     * Customer: Natural, emotional, may vary with mood
   - **Speaking Rate**:
     * Agent: Trained pace (not too fast, not too slow)
     * Customer: Variable (may rush when anxious, slow when thinking)
   - **Accent & Regional Markers**:
     * Note distinctive pronunciation patterns
     * Regional language mixing (Hindi/English code-switching patterns)
   - **Professional Markers**:
     * Agent: Formal greetings, company terminology, structured speech
     * Customer: Casual language, personal concerns, questions

2. **Voice Fingerprinting** (Create mental profile for each speaker):
   - Assign each distinct voice a unique profile
   - Track these characteristics throughout the call:
     * Vocal timbre (bright, dark, nasal, resonant)
     * Energy level (animated, calm, monotone)
     * Gender indicators (if clearly identifiable)
     * Speaking confidence (hesitant vs assured)
     * Professional training (polished vs natural speech)

3. **Consistent Speaker Tracking** (CRITICAL - DO NOT MIX UP SPEAKERS):
   - Once you identify a voice as "AGENT (Riya)", ALWAYS use that label when that SAME voice speaks
   - Once you identify a voice as "USER (Mr. Sharma)", ALWAYS use that label when that SAME voice speaks
   - DO NOT switch speaker labels mid-call unless there's a clear transfer/handoff
   - If unsure between two similar voices, listen for:
     * Context clues (who asks questions vs who provides information)
     * Professional language vs casual language
     * Company terminology usage
     * Emotional tone differences

4. **Agent vs Customer Identification Rules**:
   
   **AGENT Characteristics (Company Representative)**:
   - ✅ Introduces themselves with company name: "This is [Name] from [Company]"
   - ✅ Uses professional greetings: "Good morning/afternoon", "Thank you for calling"
   - ✅ Asks structured questions: "May I have your account number?"
   - ✅ Provides information: "Your plan includes...", "Let me check that for you"
   - ✅ Uses company jargon: "subscription", "renewal", "activation", "verification"
   - ✅ Maintains control of conversation flow
   - ✅ Often speaks first (after IVR) or answers incoming call
   - ✅ Consistent professional tone throughout
   - ✅ Trained voice modulation
   
   **USER/CUSTOMER Characteristics (Caller)**:
   - ✅ Responds to agent's greeting
   - ✅ States their problem/need: "I need help with...", "My subscription..."
   - ✅ Asks questions: "When will this...", "How much does...", "Can you..."
   - ✅ May sound uncertain, confused, or emotional
   - ✅ Uses casual language: "yeah", "okay", "I guess", "umm"
   - ✅ Variable tone (frustrated, happy, anxious, calm)
   - ✅ Natural, untrained speech patterns
   - ✅ May interrupt or need clarification
   - ✅ Provides personal information when asked

5. **Multi-Speaker Scenarios**:
   - **Multiple Agents**: Label as "Agent 1", "Agent 2" or by names if mentioned
   - **Multiple Customers**: Label as "User Primary", "User Secondary"
   - **Call Transfers**: Note when new agent joins, create new speaker profile
   - **Conference Calls**: Track up to 6 distinct voices, label clearly

6. **Voice Similarity Handling** (When two voices sound similar):
   - Rely on **CONTEXT** more than voice alone:
     * Who is asking vs answering questions?
     * Who uses professional vs casual language?
     * Who mentions company policies vs personal needs?
   - Check **conversation flow**:
     * Agent typically leads, customer responds
   - Look for **verbal cues**:
     * "As I mentioned..." = likely same speaker as before
     * "You said..." = referring to the other speaker
   - Use **role consistency**:
     * If someone introduced themselves as agent, they remain agent
     * Don't switch their identity without clear transfer

7. **Name Extraction & Tracking**:
   - When agent says "This is Riya", immediately label as "Agent (Riya)"
   - When customer says "This is Sharma" or "My name is Sharma", label as "User (Mr./Ms. Sharma)"
   - Maintain these names consistently throughout entire call
   - If name not mentioned, use "Agent 1", "User 1" etc.

8. **Verification Checkpoints** (Throughout call):
   - Every 30 seconds, mentally verify:
     * Am I maintaining speaker consistency?
     * Have I accidentally switched AGENT and USER labels?
     * Does the dialogue flow make sense with current speaker assignments?
   - If dialogue doesn't make sense, re-evaluate speaker assignment
   - Example check: If "USER" is explaining company policies, you've likely mislabeled - should be "AGENT"

**CRITICAL RULES FOR SPEAKER ATTRIBUTION:**
- ✅ Once a speaker is identified as AGENT, they REMAIN AGENT for entire call (unless transferred)
- ✅ Once a speaker is identified as USER, they REMAIN USER for entire call
- ✅ DO NOT flip-flop speaker labels between segments
- ✅ Use voice characteristics + context + role for accurate attribution
- ✅ When in doubt, context > voice similarity
- ✅ Agent typically speaks with authority/information, customer typically seeks help
- ✅ Maintain speaker identity even if call quality degrades

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

3. **Diarization Best Practices & Attribution Examples**
   - Merge micro-pauses within the same speaker's continuous speech
   - Split segments ONLY when speaker changes or audio event occurs
   - Track voice characteristics to maintain consistent speaker identification
   
   **Example 1 - Clear Agent/Customer Distinction:**
   ~~~
   [0 seconds - 12 seconds]
   AGENT (Riya): Good morning! This is Riya calling from ETPrime renewals team. Am I speaking with Mr. Amit Sharma?
   
   [12 seconds - 16 seconds]
   USER (Mr. Sharma): Uh... yes, yes, this is Amit speaking. Kaun bol rahe hain?
   
   [16 seconds - 25 seconds]
   AGENT (Riya): I'm calling regarding your ETPrime subscription which is expiring on the 30th. I wanted to discuss our special renewal offers for valued customers like yourself.
   
   [25 seconds - 30 seconds]
   USER (Mr. Sharma): Oh, achha... okay... main interested hoon. Tell me more about the offers.
   ~~~
   
   **Example 2 - Similar Voices (Use Context)**:
   ~~~
   [0 seconds - 8 seconds]
   AGENT (Sarah): Hi, thank you for calling Tech Support. This is Sarah. How can I help you today?
   
   [8 seconds - 15 seconds]
   USER (Emily): Hi Sarah, I'm having trouble with my... uh... my internet connection keeps dropping.
   
   [15 seconds - 22 seconds]
   AGENT (Sarah): I understand how frustrating that can be. Let me check your account. Can you provide your customer ID?
   
   [22 seconds - 28 seconds]
   USER (Emily): Sure, it's... um... let me find it... TC-12345-AB
   ~~~
   Note: Even if Sarah and Emily's voices sound similar, context makes it clear:
   - Sarah uses professional language ("Let me check your account")
   - Emily expresses frustration and provides information when asked
   
   **Example 3 - Multiple Speakers**:
   ~~~
   [0 seconds - 10 seconds]
   AGENT 1 (Rahul): Hello, this is Rahul from sales. I have Mr. Kapoor on the line regarding the premium plan upgrade.
   
   [10 seconds - 14 seconds]
   AGENT 2 (Priya): Great, please transfer the call. Hi Mr. Kapoor!
   
   [14 seconds - 20 seconds]
   USER (Mr. Kapoor): Hello, main apne plan ko upgrade karna chahta hoon.
   
   [20 seconds - 28 seconds]
   AGENT 2 (Priya): Absolutely! Let me explain our premium plan benefits. You'll get access to...
   ~~~
   
   **Example 4 - Preventing Mis-attribution**:
   ❌ WRONG Attribution:
   [0 seconds - 8 seconds]
   USER: Hello, thank you for calling ETPrime. This is Riya from renewals.  ← WRONG! This is clearly an AGENT
   
   ✅ CORRECT Attribution:
   [0 seconds - 8 seconds]
   AGENT (Riya): Hello, thank you for calling ETPrime. This is Riya from renewals.
   
   **Example 5 - Maintaining Consistency**:
   ~~~
   [0 seconds - 10 seconds]
   AGENT (John): Hi, this is John from customer service.
   
   [10 seconds - 15 seconds]
   USER (Maria): Hi John, I need help.
   
   [15 seconds - 20 seconds]
   AGENT (John): Sure, what can I help you with?  ← MUST be same "Agent (John)", NOT "Agent 1" or different label
   
   [20 seconds - 25 seconds]
   USER (Maria): My account is locked.  ← MUST be same "User (Maria)", maintain consistency
   ~~~
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

6. **Language Handling - CRITICAL RULES**
   - **MANDATORY**: Transcribe ALL spoken content in English Roman script (Latin alphabet) ONLY
   - **ZERO TOLERANCE** for any non-Roman scripts (Devanagari, Tamil, Telugu, Bengali, etc.)
   - **VERBATIM RULE**: Transcribe exactly what you hear - do NOT translate, do NOT paraphrase
   - **For Hindi/Hinglish/Regional Languages**: 
     * Transliterate phonetically in Roman script EXACTLY as spoken
     * Keep natural code-switching: "Thank you, bahut achha laga" stays as-is
     * Preserve spoken grammar and sentence structure
     * DO NOT convert to formal Hindi - keep colloquial expressions
   - **Transliteration Examples**:
     * Spoken: "नमस्ते" → Write: "namaste"
     * Spoken: "आप कैसे हैं?" → Write: "aap kaise hain?"
     * Spoken: "मुझे help चाहिए" → Write: "mujhe help chahiye"
     * Spoken: "बहुत achha" → Write: "bahut achha"
     * Spoken: "हां... uh... मैं सोच रहा हूं" → Write: "haan... uh... main soch raha hoon"
   - **Mixed Language**: Keep code-switching natural
     * "I'm calling क्योंकि my subscription expire हो रहा है" 
     * → "I'm calling kyunki my subscription expire ho raha hai"
   - **DO NOT**:
     * Include original Devanagari text anywhere
     * Translate to pure English
     * Clean up or formalize the language
     * Remove filler words or repetitions

### Output JSON Schema

**CRITICAL REMINDER BEFORE GENERATING OUTPUT:**
- Scan your entire output JSON for ANY non-Roman characters
- If you find Devanagari (अ आ इ), Tamil (அ ஆ), Telugu (అ ఆ), Bengali (অ আ), or any non-Latin script characters
- DELETE them immediately and rewrite using Roman alphabet (A-Z, a-z)
- This is your FINAL validation step before returning output

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
      "text": string  // MUST BE IN ROMAN SCRIPT ONLY - NO EXCEPTIONS
    }
  ],
  "summary": {
    "overview": string,  // MUST BE IN ROMAN SCRIPT ONLY
    "keyPoints": string[],  // MUST BE IN ROMAN SCRIPT ONLY
    "actions": string[]  // MUST BE IN ROMAN SCRIPT ONLY
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
- **FINAL CHECK: Your entire output must ONLY contain Roman alphabet (A-Z, a-z, 0-9, punctuation)**

### ABSOLUTELY CRITICAL - READ BEFORE SUBMITTING OUTPUT:
You are about to generate the final JSON output. Before you return it:
1. Re-read your entire output character by character
2. If you see ANY character from Devanagari (अ आ इ ई उ), Tamil (அ ஆ இ), Telugu (అ ఆ ఇ), Bengali (অ আ ই), or ANY non-Latin script
3. DELETE that character immediately
4. Replace it with Roman alphabet transliteration
5. Common Hindi words you MUST write in Roman:
   - "नमस्ते" = "namaste"
   - "धन्यवाद" = "dhanyavaad" 
   - "हाँ" = "haan"
   - "नहीं" = "nahin"
   - "ठीक है" = "theek hai"
   - "मैं" = "main"
   - "आप" = "aap"
   - "क्या" = "kya"
   - "कैसे" = "kaise"
   - "कब" = "kab"

Remember: Your output will be validated. Non-Roman characters will cause errors. Use ONLY Roman alphabet.
`;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Validates that the transcription output contains only Roman script characters
 * Logs warnings if non-Roman characters are detected
 */
function validateRomanScript(output: TranscriptionOutput): void {
  // Define regex patterns for non-Roman scripts
  const devanagariPattern = /[\u0900-\u097F]/g; // Hindi/Sanskrit
  const tamilPattern = /[\u0B80-\u0BFF]/g;
  const teluguPattern = /[\u0C00-\u0C7F]/g;
  const bengaliPattern = /[\u0980-\u09FF]/g;
  const gujaratiPattern = /[\u0A80-\u0AFF]/g;
  const kannadaPattern = /[\u0C80-\u0CFF]/g;
  const malayalamPattern = /[\u0D00-\u0D7F]/g;
  const punjabiPattern = /[\u0A00-\u0A7F]/g;

  const nonRomanPatterns = [
    { name: 'Devanagari (Hindi)', pattern: devanagariPattern },
    { name: 'Tamil', pattern: tamilPattern },
    { name: 'Telugu', pattern: teluguPattern },
    { name: 'Bengali', pattern: bengaliPattern },
    { name: 'Gujarati', pattern: gujaratiPattern },
    { name: 'Kannada', pattern: kannadaPattern },
    { name: 'Malayalam', pattern: malayalamPattern },
    { name: 'Punjabi', pattern: punjabiPattern },
  ];

  let hasNonRoman = false;

  // Check segments
  output.segments.forEach((segment, index) => {
    nonRomanPatterns.forEach(({ name, pattern }) => {
      const matches = segment.text.match(pattern);
      if (matches) {
        hasNonRoman = true;
        console.error(`⚠️ NON-ROMAN SCRIPT DETECTED in segment ${index + 1}!`);
        console.error(`   Script: ${name}`);
        console.error(`   Text: ${segment.text}`);
        console.error(`   Characters: ${matches.join(', ')}`);
      }
    });
  });

  // Check summary
  if (output.summary) {
    const summaryText = `${output.summary.overview} ${output.summary.keyPoints?.join(' ')} ${output.summary.actions?.join(' ')}`;
    nonRomanPatterns.forEach(({ name, pattern }) => {
      const matches = summaryText.match(pattern);
      if (matches) {
        hasNonRoman = true;
        console.error(`⚠️ NON-ROMAN SCRIPT DETECTED in summary!`);
        console.error(`   Script: ${name}`);
        console.error(`   Characters: ${matches.join(', ')}`);
      }
    });
  }

  if (hasNonRoman) {
    console.error('❌ VALIDATION FAILED: Output contains non-Roman characters!');
    console.error('📝 This should be transliterated to Roman script.');
  } else {
    console.log('✅ Validation passed: All text is in Roman script');
  }
}

const transcriptionFlow = ai.defineFlow(
  {
    name: 'transcriptionFlow',
    inputSchema: TranscriptionInputSchema,
    outputSchema: TranscriptionOutputSchema,
  },
  async (input: TranscriptionInput): Promise<TranscriptionOutput> => {
    console.log('Starting transcription flow for audio input...');
    const audioReference = input.audioUrl
      ? { url: input.audioUrl }
      : await resolveGeminiAudioReference(input.audioDataUri!, { displayName: 'transcription-audio' });

    if (!audioReference) {
      console.error("Failed to resolve audio reference. Input provided:", { audioUrl: input.audioUrl, hasAudioDataUri: !!input.audioDataUri });
      throw new Error("Could not resolve audio reference from either URL or data URI.");
    }

    console.log('Audio reference resolved successfully. Beginning transcription attempts.');
    // Use the robust retry manager that will keep trying until success
    return await transcriptionRetryManager.execute(async (attempt) => {
      const primaryModel = AI_MODELS.MULTIMODAL_PRIMARY;
      const fallbackModel = AI_MODELS.MULTIMODAL_SECONDARY;
      console.log(`Transcription Attempt #${attempt}`);

      // Try primary model first
      try {
        console.log(`[Attempt ${attempt}] Trying primary model: ${primaryModel}`);

        const { output, usage } = await ai.generate({
          model: primaryModel,
          prompt: [
            { media: audioReference },
            { text: TRANSCRIPTION_PROMPT },
          ],
          output: { schema: TranscriptionOutputSchema, format: 'json' },
          config: { temperature: 0.1 },
        });

        console.log(`[Attempt ${attempt}] Primary model (${primaryModel}) succeeded.`);
        console.log(`[Attempt ${attempt}] Usage:`, usage);

        if (!output) {
          console.error(`[Attempt ${attempt}] Primary model ${primaryModel} returned empty output despite success status.`);
          throw new Error(`Primary model ${primaryModel} returned empty output.`);
        }

        // Validate that output is in Roman script only
        validateRomanScript(output);

        return output;

      } catch (primaryError: any) {
        console.warn(`[Attempt ${attempt}] Primary model (${primaryModel}) failed. Error: ${primaryError.message}`);
        console.log(`[Attempt ${attempt}] Trying fallback model: ${fallbackModel}`);

        // Try fallback model
        try {
          const { output, usage } = await ai.generate({
            model: fallbackModel,
            prompt: [
              { media: audioReference },
              { text: TRANSCRIPTION_PROMPT },
            ],
            output: { schema: TranscriptionOutputSchema, format: 'json' },
            config: { temperature: 0.1 },
          });

          console.log(`[Attempt ${attempt}] Fallback model (${fallbackModel}) succeeded.`);
          console.log(`[Attempt ${attempt}] Usage:`, usage);

          if (!output) {
            console.error(`[Attempt ${attempt}] Fallback model ${fallbackModel} also returned empty output.`);
            throw new Error(`Fallback model ${fallbackModel} also returned empty output.`);
          }

          // Validate that output is in Roman script only
          validateRomanScript(output);

          return output;

        } catch (fallbackError: any) {
          console.error(`[Attempt ${attempt}] Both primary and fallback models failed.`);
          console.error(`[Attempt ${attempt}] Primary Error:`, primaryError);
          console.error(`[Attempt ${attempt}] Fallback Error:`, fallbackError);
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
  console.log('transcribeAudio function called. Invoking transcriptionFlow...');
  try {
    const result = await transcriptionFlow(input);
    console.log('transcriptionFlow completed successfully.');
    return result;
  } catch (error) {
    console.error('An error occurred during the transcription process in transcribeAudio:', error);
    // Depending on desired behavior, you might want to re-throw or handle it
    throw error;
  }
}

// Helper function for building system prompt
export function buildTranscriptionSystemPrompt(): string {
  return TRANSCRIPTION_PROMPT;
}
