# Transcript Consistency & Speaker Attribution Guide

## 🎯 Purpose

This guide ensures **100% consistent** transcript output format and **accurate speaker attribution** across all transcription operations in AI-TeleSuite.

---

## 📋 Standard Output Format

### 1. Segment Structure (MANDATORY)

Every transcript segment MUST follow this exact structure:

```
[startTime - endTime]
SPEAKER (Profile): Transcribed text content
```

**Example:**
```
[0 seconds - 12 seconds]
AGENT (Riya): Hello, this is Riya calling from ETPrime renewals team. Am I speaking with Mr. Sharma?

[12 seconds - 18 seconds]
USER (Mr. Sharma): Uh... yes, this is Sharma. Kaun bol rahe hain?
```

### 2. Speaker Categories (STRICT ENUM)

**Only three speaker types allowed:**

| Speaker Type | When to Use | Profile Format |
|--------------|-------------|----------------|
| `AGENT` | Company representatives, sales agents, support staff | `Agent (Name)` or `Agent 1`, `Agent 2` |
| `USER` | Customers, callers, prospects | `User (Name)` or `User 1`, `User 2` |
| `SYSTEM` | IVR, ringing, hold music, background noise, any non-human audio | `IVR`, `Call Ringing`, `Call on Hold`, `Background Noise - [Type]` |

### 3. Profile Naming Convention

#### For AGENT:
- **With name**: `Agent (Riya)`, `Agent (John)`, `Agent (Sarah)`
- **Without name**: `Agent 1`, `Agent 2`, `Agent 3`
- **Pre-call**: `Pre-Call - Agent (Name)`

#### For USER:
- **With name**: `User (Mr. Sharma)`, `User (Ms. Patel)`, `User (Emily)`
- **Without name**: `User 1`, `User 2`
- **Multiple customers**: `User Primary`, `User Secondary`

#### For SYSTEM:
- **IVR**: `IVR` or `IVR - [Company Name]`
- **Call states**: `Call Ringing`, `Call on Hold`, `Busy Signal`, `Dead Air`
- **Audio events**: `Background Noise - Office`, `Background Noise - Traffic`, `DTMF Tone`

---

## 🎤 Speaker Attribution Rules

### Critical Rule #1: Consistency is Sacred

**Once a speaker is identified, their label NEVER changes throughout the call.**

❌ **WRONG - Label Inconsistency:**
```
[0 seconds - 10 seconds]
AGENT (John): Hi, this is John from support.

[20 seconds - 30 seconds]
AGENT 1: Let me check your account.  ← WRONG! Should be "Agent (John)"
```

✅ **CORRECT - Consistent Labeling:**
```
[0 seconds - 10 seconds]
AGENT (John): Hi, this is John from support.

[20 seconds - 30 seconds]
AGENT (John): Let me check your account.  ← CORRECT! Same speaker = same label
```

### Critical Rule #2: Voice Profiling First

**Create a mental voice profile in the first 5 seconds:**

1. **Pitch Range**: High, medium, low fundamental frequency
2. **Tone Quality**: Professional/trained vs natural/emotional
3. **Speaking Rate**: Consistent pace vs variable pace
4. **Accent Markers**: Regional pronunciation patterns
5. **Professional Markers**: Company terminology, formal greetings

### Critical Rule #3: Context Over Voice Similarity

When two voices sound similar, use **CONTEXT** to distinguish:

**Contextual Clues for AGENT:**
- ✅ Uses company name: "calling from ETPrime"
- ✅ Professional greetings: "Thank you for calling"
- ✅ Asks structured questions: "May I have your account number?"
- ✅ Provides information: "Your plan includes..."
- ✅ Uses company jargon: "subscription", "renewal", "activation"
- ✅ Leads the conversation flow
- ✅ Consistent professional tone

**Contextual Clues for USER:**
- ✅ Responds to agent's greeting
- ✅ States problem/need: "I need help with..."
- ✅ Asks questions: "When will...", "How much..."
- ✅ Sounds uncertain/emotional
- ✅ Uses casual language: "yeah", "okay", "umm"
- ✅ Variable emotional tone
- ✅ Provides personal information when asked

### Critical Rule #4: Name Extraction & Tracking

**Extract names immediately when mentioned:**

```
[0 seconds - 10 seconds]
AGENT: Hello, this is Riya calling from ETPrime.
       ↓
Label as: AGENT (Riya)  ← Extract "Riya" immediately

[10 seconds - 15 seconds]
USER: Hi, this is Sharma speaking.
      ↓
Label as: USER (Mr. Sharma)  ← Extract "Sharma" immediately
```

**Maintain these names throughout the entire call:**
- ✅ Once `AGENT (Riya)` → Always `AGENT (Riya)`
- ✅ Once `USER (Mr. Sharma)` → Always `USER (Mr. Sharma)`
- ❌ Never switch to `Agent 1` or `User 1` mid-call

### Critical Rule #5: Verification Checkpoints

**Every 30 seconds, mentally verify:**

1. Am I maintaining speaker consistency?
2. Have I accidentally switched AGENT and USER labels?
3. Does the dialogue flow make sense with current speaker assignments?

**Self-Check Questions:**
- If "USER" is explaining company policies → **WRONG!** Should be AGENT
- If "AGENT" is asking about their own subscription → **WRONG!** Should be USER
- If speaker introduces themselves as company rep → **MUST be AGENT**
- If speaker is seeking help/information → **MUST be USER**

---

## 🔍 Common Attribution Errors & Fixes

### Error Type 1: Flipping Labels Mid-Call

❌ **WRONG:**
```
[0 seconds - 10 seconds]
AGENT (Sarah): Hi, this is Sarah from Tech Support.

[10 seconds - 20 seconds]
USER: I need help with my internet.

[30 seconds - 40 seconds]
AGENT: Let me check that for you.  ← WRONG! Missing "(Sarah)"

[50 seconds - 60 seconds]
USER (Sarah): Your account shows...  ← WRONG! Sarah is AGENT, not USER!
```

✅ **CORRECT:**
```
[0 seconds - 10 seconds]
AGENT (Sarah): Hi, this is Sarah from Tech Support.

[10 seconds - 20 seconds]
USER (Emily): I need help with my internet.

[30 seconds - 40 seconds]
AGENT (Sarah): Let me check that for you.  ← CORRECT! Consistent label

[50 seconds - 60 seconds]
AGENT (Sarah): Your account shows...  ← CORRECT! Sarah is AGENT throughout
```

### Error Type 2: Incorrect Initial Attribution

❌ **WRONG - Agent labeled as User:**
```
[0 seconds - 10 seconds]
USER: Thank you for calling ETPrime. This is Riya from renewals.
      ↑
      WRONG! This is clearly an AGENT introducing themselves
```

✅ **CORRECT:**
```
[0 seconds - 10 seconds]
AGENT (Riya): Thank you for calling ETPrime. This is Riya from renewals.
              ↑
              CORRECT! Company greeting = AGENT
```

### Error Type 3: Not Using Extracted Names

❌ **WRONG - Name extracted but not used consistently:**
```
[0 seconds - 8 seconds]
AGENT (John): Hi, this is John from customer service.

[20 seconds - 30 seconds]
AGENT: How can I help you today?  ← WRONG! Should include "(John)"

[40 seconds - 50 seconds]
AGENT 1: Let me look that up.  ← WRONG! Should be "AGENT (John)"
```

✅ **CORRECT:**
```
[0 seconds - 8 seconds]
AGENT (John): Hi, this is John from customer service.

[20 seconds - 30 seconds]
AGENT (John): How can I help you today?  ← CORRECT! Always include name

[40 seconds - 50 seconds]
AGENT (John): Let me look that up.  ← CORRECT! Consistent throughout
```

### Error Type 4: Similar Voices Mixed Up

**Scenario:** Two female voices sound similar (Agent Sarah, Customer Emily)

❌ **WRONG - Relying only on voice:**
```
[0 seconds - 10 seconds]
AGENT (Sarah): Hi, can I have your account number?

[10 seconds - 15 seconds]
AGENT (Sarah): It's TC-12345-AB.  ← WRONG! This is customer providing info
```

✅ **CORRECT - Using context:**
```
[0 seconds - 10 seconds]
AGENT (Sarah): Hi, can I have your account number?
               ↑
               Asking for information = AGENT

[10 seconds - 15 seconds]
USER (Emily): It's TC-12345-AB.  ← CORRECT! Providing info = USER
              ↑
              Responding with personal info = USER
```

**Key Insight:** 
- Person ASKING for information = AGENT
- Person PROVIDING personal information = USER

---

## 📊 Output Format Validation

### Required Fields (MUST BE PRESENT)

```typescript
{
  "callMeta": {
    "sampleRateHz": number | null,
    "durationSeconds": number | null
  },
  "segments": [
    {
      "startSeconds": number,        // REQUIRED: Must be less than endSeconds
      "endSeconds": number,          // REQUIRED: Must be greater than startSeconds
      "speaker": "AGENT" | "USER" | "SYSTEM",  // REQUIRED: Exactly one of these three
      "speakerProfile": string,      // REQUIRED: "Agent (Name)" format
      "text": string                 // REQUIRED: Actual transcribed content
    }
  ],
  "summary": {
    "overview": string,              // REQUIRED: Comprehensive call summary
    "keyPoints": string[],           // REQUIRED: Array of important moments
    "actions": string[]              // REQUIRED: Array of action items
  }
}
```

### Validation Checklist

Before returning any transcript output, verify:

- [ ] All segments have `startSeconds < endSeconds`
- [ ] All `speaker` values are exactly `"AGENT"`, `"USER"`, or `"SYSTEM"`
- [ ] All `speakerProfile` values follow the naming convention
- [ ] Same speaker uses same label throughout (e.g., `AGENT (Riya)` never becomes `AGENT 1`)
- [ ] Agent introducing with company name is labeled as `AGENT`, not `USER`
- [ ] Customer seeking help is labeled as `USER`, not `AGENT`
- [ ] IVR/automated systems are labeled as `SYSTEM`, not `AGENT`
- [ ] All text is in Roman script only (no Devanagari, Tamil, Telugu, etc.)
- [ ] Names extracted from dialogue are included in `speakerProfile`

---

## 🚨 Roman Script Requirement

### Absolute Rule: Roman Alphabet Only

**All transcript text MUST use only:**
- English letters: A-Z, a-z
- Numbers: 0-9
- Punctuation: . , ! ? : ; ' " - ...
- Brackets: [ ] for timestamps/events

**NEVER use:**
- ❌ Devanagari (Hindi): अ आ इ ई उ
- ❌ Tamil: அ ஆ இ ஈ உ
- ❌ Telugu: అ ఆ ఇ ఈ ఉ
- ❌ Bengali: অ আ ই ঈ উ
- ❌ Any other non-Latin scripts

### Transliteration Examples

| Spoken (Hindi) | ❌ WRONG (Devanagari) | ✅ CORRECT (Roman) |
|----------------|----------------------|---------------------|
| "नमस्ते" | नमस्ते | namaste |
| "धन्यवाद" | धन्यवाद | dhanyavaad |
| "मैं ठीक हूं" | मैं ठीक हूं | main theek hoon |
| "आप कैसे हैं?" | आप कैसे हैं? | aap kaise hain? |
| "हाँ, बिल्कुल" | हाँ, बिल्कुल | haan, bilkul |

### Mixed Language (Hinglish) Examples

| Spoken | ✅ CORRECT Transcription |
|--------|---------------------------|
| "I'm calling क्योंकि my subscription expire हो रहा है" | "I'm calling kyunki my subscription expire ho raha hai" |
| "Thank you, बहुत अच्छा लगा" | "Thank you, bahut achha laga" |
| "Main interested हूं in the offer" | "Main interested hoon in the offer" |

---

## 🎯 Implementation Across All Modules

### Module 1: Transcription Page (`/transcription`)

**Ensures:**
- ✅ Consistent segment format in `TranscriptionOutput`
- ✅ Speaker labels follow enum: `AGENT`, `USER`, `SYSTEM`
- ✅ Profile names extracted and maintained
- ✅ Roman script validation applied
- ✅ Display uses `TranscriptDisplay` component for consistent rendering

### Module 2: Call Scoring (`/call-scoring`)

**Uses transcription output and ensures:**
- ✅ Accepts transcripts with consistent speaker labels
- ✅ `transcriptOverride` follows same format
- ✅ Speaker attribution remains consistent through scoring
- ✅ Display uses same `TranscriptDisplay` component

### Module 3: Voice Agents (`/voice-sales-agent`, `/voice-support-agent`)

**Ensures:**
- ✅ Generated transcripts follow same format
- ✅ Agent/User distinction maintained
- ✅ Call review shows consistent transcript format
- ✅ Uses shared `TranscriptDisplay` component

### Module 4: Combined Call Analysis

**Ensures:**
- ✅ Multiple transcripts maintain consistent format
- ✅ Cross-call comparisons use same speaker labels
- ✅ Aggregate views use standardized format

---

## 🔧 Technical Implementation

### 1. Type Enforcement (TypeScript)

```typescript
// MANDATORY speaker enum - no other values allowed
export type Speaker = 'AGENT' | 'USER' | 'SYSTEM';

// Segment structure - enforced by Zod schema
export interface TranscriptionSegment {
  startSeconds: number;
  endSeconds: number;
  speaker: Speaker;  // MUST be one of the three enum values
  speakerProfile: string;  // MUST follow naming convention
  text: string;  // MUST be Roman script only
}
```

### 2. Runtime Validation

```typescript
function validateTranscriptionOutput(output: TranscriptionOutput): void {
  // 1. Validate speaker enum
  output.segments.forEach((seg, idx) => {
    if (!['AGENT', 'USER', 'SYSTEM'].includes(seg.speaker)) {
      throw new Error(`Invalid speaker at segment ${idx}: ${seg.speaker}`);
    }
  });

  // 2. Validate time ordering
  output.segments.forEach((seg, idx) => {
    if (seg.startSeconds >= seg.endSeconds) {
      throw new Error(`Invalid time range at segment ${idx}`);
    }
  });

  // 3. Validate Roman script
  validateRomanScript(output);

  // 4. Validate speaker consistency
  validateSpeakerConsistency(output);
}
```

### 3. Speaker Consistency Validation

```typescript
function validateSpeakerConsistency(output: TranscriptionOutput): void {
  const speakerProfiles = new Map<string, string>();
  
  output.segments.forEach((seg, idx) => {
    // Extract base speaker (e.g., "Agent (Riya)" -> "Riya")
    const profileMatch = seg.speakerProfile.match(/\(([^)]+)\)/);
    if (profileMatch) {
      const name = profileMatch[1];
      const expectedSpeaker = seg.speaker;
      
      if (speakerProfiles.has(name)) {
        const previousSpeaker = speakerProfiles.get(name);
        if (previousSpeaker !== expectedSpeaker) {
          console.error(`⚠️ SPEAKER INCONSISTENCY at segment ${idx}!`);
          console.error(`   Name: ${name}`);
          console.error(`   Previous: ${previousSpeaker}`);
          console.error(`   Current: ${expectedSpeaker}`);
          console.error(`   This indicates the AI may have confused speakers!`);
        }
      } else {
        speakerProfiles.set(name, expectedSpeaker);
      }
    }
  });
}
```

### 4. Formatting Utility (Shared)

```typescript
// lib/transcript-utils.ts - Already implemented
export function formatTranscriptSegments(output: TranscriptionOutput): string {
  return output.segments
    .map((segment) => {
      const startTime = formatSeconds(segment.startSeconds);
      const endTime = formatSeconds(segment.endSeconds);
      const timeRange = `[${startTime} - ${endTime}]`;
      const speakerLine = `${segment.speakerProfile}: ${segment.text}`;
      return `${timeRange}\n${speakerLine}`;
    })
    .join('\n\n');
}
```

---

## 📝 Quality Assurance Checklist

### Before Finalizing Transcript

- [ ] **Consistency Check**: Each named speaker uses the same label throughout
- [ ] **Attribution Check**: AGENT introduces company, USER seeks help
- [ ] **Format Check**: All segments follow `[time]\nSPEAKER (Profile): Text` format
- [ ] **Enum Check**: All speakers are exactly `AGENT`, `USER`, or `SYSTEM`
- [ ] **Name Check**: Extracted names appear in all segments for that speaker
- [ ] **Script Check**: All text uses Roman alphabet only
- [ ] **Context Check**: Speaker roles make logical sense in conversation flow
- [ ] **Validation Check**: Output passes TypeScript type checking
- [ ] **Display Check**: Renders correctly in `TranscriptDisplay` component

### Post-Transcription Validation

1. **Run Roman Script Validator**: Check for non-Latin characters
2. **Run Consistency Validator**: Check speaker label consistency
3. **Run Format Validator**: Verify JSON schema compliance
4. **Visual Review**: Inspect in UI to ensure proper rendering
5. **Cross-Module Check**: Ensure transcript works across all features

---

## 🎓 Training Examples

### Example 1: Perfect Attribution (Sales Call)

```
[0 seconds - 15 seconds]
AGENT (Riya): Good morning! This is Riya calling from ETPrime renewals team. Am I speaking with Mr. Amit Sharma?

[15 seconds - 22 seconds]
USER (Mr. Sharma): Uh... yes, yes, this is Amit. Main sun raha hoon, boliye.

[22 seconds - 38 seconds]
AGENT (Riya): Thank you, Mr. Sharma. I'm calling to inform you that your ETPrime subscription expires on November 30th. We have some exclusive renewal offers for valued customers like yourself.

[38 seconds - 48 seconds]
USER (Mr. Sharma): Achha, theek hai. Kitne ka offer hai? Tell me the price details please.

[48 seconds - 75 seconds]
AGENT (Riya): Certainly! For the annual plan, we're offering a special rate of rupees 999 instead of the regular 1499. This gives you complete access to ETPrime Prime articles, plus our mobile app, plus exclusive market insights.
```

**✅ Perfect because:**
- Riya consistently labeled as `AGENT (Riya)` - never changes
- Mr. Sharma consistently labeled as `USER (Mr. Sharma)` - never changes
- Agent introduces company and leads conversation
- User responds and asks questions
- Hinglish mixed naturally in Roman script
- Time ranges are sequential and logical

### Example 2: Multiple Agents (Transfer Call)

```
[0 seconds - 10 seconds]
AGENT 1 (Rahul): Hello, Tech Support. This is Rahul speaking.

[10 seconds - 18 seconds]
USER (Ms. Patel): Hi, I need help with my login issue.

[18 seconds - 28 seconds]
AGENT 1 (Rahul): I understand. Let me transfer you to our account specialist. Please hold.

[28 seconds - 35 seconds]
SYSTEM (Call on Hold): [Hold music playing]

[35 seconds - 45 seconds]
AGENT 2 (Priya): Hello Ms. Patel, this is Priya from accounts team. I understand you're having login issues?

[45 seconds - 52 seconds]
USER (Ms. Patel): Yes, main apna password bhul gayi hoon.

[52 seconds - 70 seconds]
AGENT 2 (Priya): No problem! I can help you reset it. Can you please verify your registered email address?
```

**✅ Perfect because:**
- Two distinct agents: `AGENT 1 (Rahul)` and `AGENT 2 (Priya)`
- User consistently labeled as `USER (Ms. Patel)` throughout
- Transfer clearly marked with `SYSTEM` segment
- Each agent maintains their own consistent label
- Context clearly shows role transitions

### Example 3: IVR + Agent + User

```
[0 seconds - 5 seconds]
SYSTEM (Call Ringing): [Phone ringing - outbound call]

[5 seconds - 18 seconds]
SYSTEM (IVR): Thank you for calling ETPrime customer service. For subscriptions, press 1. For technical support, press 2. For billing queries, press 3.

[18 seconds - 20 seconds]
SYSTEM (DTMF Tone): [Button press detected - option selected]

[20 seconds - 28 seconds]
SYSTEM (IVR): Please hold while we connect you to our subscription specialist.

[28 seconds - 35 seconds]
SYSTEM (Call on Hold): [Hold music]

[35 seconds - 48 seconds]
AGENT (Neha): Hello! Thank you for waiting. This is Neha from ETPrime subscriptions. How may I help you today?

[48 seconds - 58 seconds]
USER (Mr. Kumar): Hi Neha, mujhe apne subscription ke baare mein puchna hai. When is it expiring?

[58 seconds - 78 seconds]
AGENT (Neha): Let me check that for you, Mr. Kumar. May I have your registered mobile number or email address please?
```

**✅ Perfect because:**
- IVR clearly labeled as `SYSTEM (IVR)`
- Hold music labeled as `SYSTEM (Call on Hold)`
- Agent labeled as `AGENT (Neha)` consistently
- User labeled as `USER (Mr. Kumar)` consistently
- Non-human audio properly categorized as SYSTEM
- Human conversation properly categorized as AGENT/USER

---

## 🚀 Deployment & Monitoring

### 1. Pre-Deployment Checks

- [ ] All validation functions implemented
- [ ] Roman script validator active
- [ ] Consistency checker integrated
- [ ] Format validator running
- [ ] TypeScript types enforced
- [ ] Shared utilities used everywhere

### 2. Runtime Monitoring

Monitor these metrics:
- **Speaker Consistency Rate**: % of transcripts with consistent speaker labels
- **Attribution Accuracy**: % of AGENT/USER correctly identified
- **Roman Script Compliance**: % of transcripts with only Roman characters
- **Format Compliance**: % of transcripts passing schema validation

### 3. User Feedback Integration

Collect feedback on:
- Speaker attribution accuracy
- Name extraction quality
- Transcript readability
- Format consistency
- Roman script transliteration quality

---

## 📚 Related Documentation

- **Transcription Flow Details**: `src/ai/flows/transcription-flow.ts`
- **Type Definitions**: `src/types/index.ts`
- **Display Component**: `src/components/features/transcription/transcript-display.tsx`
- **Formatting Utilities**: `src/lib/transcript-utils.ts`
- **Large File Optimization**: `docs/LARGE_FILE_OPTIMIZATION.md`

---

## ✅ Success Criteria

A transcript meets quality standards when:

1. ✅ **100% speaker consistency**: Same person = same label throughout
2. ✅ **Correct AGENT/USER attribution**: Roles make logical sense
3. ✅ **Proper name extraction**: Names used in labels when mentioned
4. ✅ **Format compliance**: Matches exact schema structure
5. ✅ **Roman script only**: No non-Latin characters anywhere
6. ✅ **Logical flow**: Conversation makes sense with assigned speakers
7. ✅ **System events captured**: IVR, hold, ringing properly labeled
8. ✅ **Cross-module compatibility**: Works in all features/views

---

**Last Updated**: 8 November 2025  
**Version**: 1.0  
**Status**: Active - Enforced across all transcription operations
