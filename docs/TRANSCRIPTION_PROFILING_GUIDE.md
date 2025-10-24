# Transcription Profiling & Speaker Attribution Guide

## Overview
This document describes the enhanced transcription system that provides accurate speaker diarization, IVR detection, and comprehensive audio environment analysis for all call recordings in AI-Telesuite.

## Enhanced Features

### 1. Speaker Diarization & Identification
The system now performs advanced speaker profiling with:

- **Voice Analysis**: Tracks pitch, tone, gender, accent, and speaking style
- **Consistent Tracking**: Maintains speaker identity throughout the entire call
- **Name Detection**: Automatically identifies speaker names when mentioned in conversation
- **Multi-Speaker Support**: Handles multiple agents and customers on the same call

#### Speaker Categories

**AGENT**
- Company representatives, sales agents, support staff
- Format: `Agent (Name)` or `Agent 1`, `Agent 2` if names unknown
- Characteristics: Professional tone, trained speaking style

**USER**
- Customers, callers, prospects
- Format: `User (Name)` or `User Primary`, `User Secondary` for multiple callers
- Characteristics: Varied tone, may sound uncertain or emotional

**SYSTEM**
- All non-human audio events (see detailed breakdown below)

### 2. IVR & Automated System Detection

The system now accurately detects and labels Interactive Voice Response (IVR) systems:

#### IVR Characteristics Detected:
- **Voice Quality**: Robotic/synthesized voice, consistent tone, no emotional variation
- **Content Patterns**:
  - Menu options: "Press 1 for..., Press 2 for..."
  - Confirmation prompts: "Please say yes or no"
  - Authentication: "Please enter your account number"
  - Automated greetings: "Thank you for calling [Company]"
  - Queue messages: "Your call is important to us"
  - Hold announcements: "Please stay on the line"
- **Audio Cues**: DTMF tones (keypad beeps), mechanical voice quality

#### Example IVR Segment:
```
[3 seconds - 8 seconds]
SYSTEM (IVR): Thank you for calling ETPrime customer service. Please press 1 for subscriptions, press 2 for technical support.
```

### 3. Call State Detection

#### Ringing/Dialing
- Detects repetitive ringtone patterns, dial tones, connection sounds
- Label: `speaker="SYSTEM"`, `speakerProfile="Call Ringing"`
- Text: `[Call ringing - awaiting connection]`

#### Call on Hold
- Detects hold music, silence with beeps, hold announcements
- Label: `speaker="SYSTEM"`, `speakerProfile="Call on Hold"`
- Text: `[Call on hold - music playing]` or `[Call on hold - silence]`

#### Busy Signal
- Fast beep pattern indicating line busy
- Label: `speaker="SYSTEM"`, `speakerProfile="Busy Signal"`
- Text: `[Busy signal detected]`

#### Dead Air/Silence
- Prolonged silence with no activity
- Label: `speaker="SYSTEM"`, `speakerProfile="Dead Air"`
- Text: `[Silence - no active audio]`

### 4. Background Noise & Environment Analysis

The system analyzes but doesn't over-report background noise. Only significant events are logged.

#### Background Types Detected:
- **Office Noise**: Typing, multiple conversations, printers
- **Call Center Environment**: Cross-talk from other agents
- **Customer Environment**: TV, children, traffic, outdoor sounds
- **Technical Issues**: Static, echo, feedback, poor connection

#### When Background Noise is Reported:
- Only if it significantly affects call quality or comprehension
- Label: `speaker="SYSTEM"`, `speakerProfile="Background Noise - [Type]"`
- Example: `[Background: office chatter]` or `[Background: poor connection quality]`

### 5. Pre-Call & Internal Conversations

The system detects agent-to-agent or internal discussions before customer connects:
- Phrases like "I'm connecting you now", "Can you take this call?"
- Whispered discussions between agents
- Label: `speaker="AGENT"`, `speakerProfile="Pre-Call - Agent [Name]"`
- Clearly marked to distinguish from customer conversation

### 6. DTMF Tone Detection

Keypad button presses during IVR navigation:
- Label: `speaker="SYSTEM"`, `speakerProfile="DTMF Tone"`
- Text: `[DTMF tone - button press detected]`

## Transcript Output Format

### Segment Structure
Each segment contains:
```typescript
{
  startSeconds: number,        // Start time of segment
  endSeconds: number,          // End time of segment
  speaker: "AGENT" | "USER" | "SYSTEM",
  speakerProfile: string,      // Detailed identification
  text: string                 // Transcribed speech or audio description
}
```

### Example Complete Transcript

```json
{
  "callMeta": {
    "sampleRateHz": 16000,
    "durationSeconds": 182
  },
  "segments": [
    {
      "startSeconds": 0,
      "endSeconds": 3,
      "speaker": "SYSTEM",
      "speakerProfile": "Call Ringing",
      "text": "[Call ringing - awaiting connection]"
    },
    {
      "startSeconds": 3,
      "endSeconds": 12,
      "speaker": "SYSTEM",
      "speakerProfile": "IVR",
      "text": "Thank you for calling ETPrime customer service. Please press 1 for subscriptions, press 2 for technical support, or press 0 to speak with an agent."
    },
    {
      "startSeconds": 12,
      "endSeconds": 13,
      "speaker": "SYSTEM",
      "speakerProfile": "DTMF Tone",
      "text": "[DTMF tone - button press detected]"
    },
    {
      "startSeconds": 13,
      "endSeconds": 18,
      "speaker": "SYSTEM",
      "speakerProfile": "IVR",
      "text": "Please hold while we connect you to a customer service representative."
    },
    {
      "startSeconds": 18,
      "endSeconds": 35,
      "speaker": "SYSTEM",
      "speakerProfile": "Call on Hold",
      "text": "[Call on hold - music playing]"
    },
    {
      "startSeconds": 35,
      "endSeconds": 48,
      "speaker": "AGENT",
      "speakerProfile": "Agent (Riya)",
      "text": "Hello, good afternoon! You're speaking with Riya from the ETPrime renewals team. Am I speaking with Mr. Sharma?"
    },
    {
      "startSeconds": 48,
      "endSeconds": 52,
      "speaker": "USER",
      "speakerProfile": "User (Mr. Sharma)",
      "text": "Yes, this is Sharma speaking. How can I help you today?"
    },
    {
      "startSeconds": 52,
      "endSeconds": 54,
      "speaker": "SYSTEM",
      "speakerProfile": "Background Noise - Office",
      "text": "[Background: brief cross-talk from adjacent agents]"
    },
    {
      "startSeconds": 54,
      "endSeconds": 75,
      "speaker": "AGENT",
      "speakerProfile": "Agent (Riya)",
      "text": "Thank you for taking my call, Mr. Sharma. I'm reaching out regarding your ETPrime subscription which is set to expire on the 30th of this month. I wanted to discuss a special renewal offer we have for valued customers like yourself."
    }
  ],
  "summary": {
    "overview": "Sales call for ETPrime subscription renewal. Customer navigated IVR system, experienced 17-second hold time, then connected with Agent Riya. Discussion focused on renewal offer with positive customer engagement. Minor background noise noted but did not affect call quality.",
    "keyPoints": [
      "IVR navigation took 15 seconds before agent connection",
      "Hold time: 17 seconds with music",
      "Agent (Riya) clearly identified herself and purpose",
      "Customer (Mr. Sharma) responsive and engaged",
      "Minor office background noise at 52s mark"
    ],
    "actions": [
      "Follow up on renewal offer discussed",
      "Send confirmation email to customer",
      "Schedule callback if needed"
    ]
  }
}
```

## Integration with Call Scoring

The enhanced transcription integrates seamlessly with call scoring:

### Call Scoring Instructions
- **Focus on AGENT and USER dialogues only**
- **SYSTEM segments provide context** (IVR navigation, hold times, pre-call prep)
- **Don't score SYSTEM segments** - they're environmental context
- **Note IVR/hold times in summary** - they affect customer experience
- **Background noise affects quality scores** - if communication was impacted

### Example Scoring Consideration
```
If transcript shows:
- 45 seconds of IVR navigation
- 60 seconds of hold time
- Background noise affecting 3 segments

Scorer considers:
✓ Long wait time may have affected customer mood (note in summary)
✓ Background noise impacts "Call Quality" and "Professionalism" metrics
✓ Agent performance measured only on actual dialogue segments
✗ IVR and hold segments are NOT scored as agent performance
```

## Language Handling

### Transliteration Rules
All non-English languages are transcribed in Roman script (Latin alphabet):

**Hindi/Devanagari Examples:**
- "नमस्ते" → `namaste`
- "आप कैसे हैं?" → `aap kaise hain?`
- "धन्यवाद" → `dhanyavaad`
- "बहुत अच्छा" → `bahut achha`

**Mixed Language:**
- "Thank you, bahut achha laga" → `Thank you, bahut achha laga`
- "Main interested hoon" → `Main interested hoon`

### Regional Language Support
- Tamil, Telugu, Bengali, Marathi, Gujarati, etc.
- All transcribed in Roman script for consistency
- Meaning preserved through phonetic transliteration

## Privacy & Redaction

All Personally Identifiable Information (PII) is automatically redacted:

- **OTP**: `[REDACTED: OTP]`
- **Card Numbers**: `[REDACTED: Card Number]`
- **SSN/Aadhaar**: `[REDACTED: SSN]` or `[REDACTED: Aadhaar]`
- **Account Numbers**: `[REDACTED: Account Number]`
- **Passwords**: `[REDACTED: Password]`
- **Personal Addresses**: `[REDACTED: Address]`

Context is maintained without exposing sensitive data.

## Technical Implementation

### Files Modified
1. **`src/ai/flows/transcription-flow.ts`**
   - Enhanced TRANSCRIPTION_PROMPT with comprehensive audio analysis instructions
   - Added detailed IVR detection patterns
   - Included background noise analysis guidelines

2. **`src/types/index.ts`**
   - Enhanced TranscriptionOutputSchema with descriptive documentation
   - Added detailed speakerProfile format specifications
   - Clarified speaker category usage (AGENT, USER, SYSTEM)

3. **`src/ai/flows/call-scoring.ts`**
   - Updated getContextualPrompt with SYSTEM segment handling instructions
   - Added speaker label explanations for scorers
   - Enhanced text-only fallback with SYSTEM segment awareness

### AI Model Configuration
- **Primary Model**: Gemini 2.0 Flash (multimodal analysis)
- **Fallback Model**: Gemini 1.5 Pro (when primary unavailable)
- **Temperature**: 0.1 (for consistent, accurate transcription)
- **Output Format**: Structured JSON matching TranscriptionOutputSchema

## Best Practices

### For Accurate Diarization
1. Ensure audio quality is good (16kHz+ sample rate recommended)
2. Minimize background noise in recording environment
3. Use proper microphone equipment for agents
4. Keep agent introductions clear with full names

### For IVR Detection
1. System works best with clear IVR audio
2. DTMF tones should be audible in recording
3. IVR menus with clear speech recognition work well

### For Call Quality Analysis
1. Review SYSTEM segments for customer experience insights
2. Check hold times and IVR navigation duration
3. Note background noise segments that affect quality
4. Consider pre-call segments for agent preparation assessment

## Troubleshooting

### Issue: Speaker misidentification
**Solution**: Ensure speakers introduce themselves clearly, or manually review and provide feedback

### Issue: IVR not detected
**Solution**: Check if IVR audio is clear and distinct from human speech. May need audio quality improvement.

### Issue: Excessive background noise segments
**Solution**: System only reports significant noise. If over-reporting, audio quality may be poor.

### Issue: Missing speaker names
**Solution**: Names are extracted from introductions like "This is [Name] from [Company]". Ensure agents follow introduction protocol.

## Summary

The enhanced transcription system provides:
- ✅ **Accurate speaker diarization** with voice analysis
- ✅ **IVR detection** with pattern recognition
- ✅ **Call state tracking** (ringing, hold, busy, dead air)
- ✅ **Background noise analysis** when significant
- ✅ **Pre-call conversation** detection
- ✅ **DTMF tone** recognition
- ✅ **Multi-language support** with Roman script transliteration
- ✅ **PII redaction** for privacy compliance
- ✅ **Seamless integration** with call scoring system

This comprehensive profiling ensures that all call recordings are accurately transcribed with full environmental context, enabling better analysis and quality assessment.
