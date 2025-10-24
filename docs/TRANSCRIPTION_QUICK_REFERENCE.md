# Quick Reference: Enhanced Transcription Speaker Types

## Speaker Categories

### AGENT
**When to use:** Company representatives, sales agents, support staff
```typescript
{
  speaker: "AGENT",
  speakerProfile: "Agent (Riya)" // or "Agent 1" if name unknown
}
```

### USER
**When to use:** Customers, callers, prospects
```typescript
{
  speaker: "USER",
  speakerProfile: "User (Mr. Sharma)" // or "User Primary" for multiple
}
```

### SYSTEM
**When to use:** ALL non-human audio events

#### System Sub-types:

**IVR (Interactive Voice Response)**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "IVR",
  text: "Thank you for calling. Press 1 for sales..."
}
```

**Call Ringing**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "Call Ringing",
  text: "[Call ringing - awaiting connection]"
}
```

**Call on Hold**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "Call on Hold",
  text: "[Call on hold - music playing]"
}
```

**Busy Signal**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "Busy Signal",
  text: "[Busy signal detected]"
}
```

**Dead Air**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "Dead Air",
  text: "[Silence - no active audio]"
}
```

**Background Noise**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "Background Noise - Office",
  text: "[Background: office chatter]"
}
// Types: Office, Call Center, Poor Connection, Static, etc.
```

**DTMF Tone**
```typescript
{
  speaker: "SYSTEM",
  speakerProfile: "DTMF Tone",
  text: "[DTMF tone - button press detected]"
}
```

**Pre-Call**
```typescript
{
  speaker: "AGENT", // Note: Uses AGENT, not SYSTEM
  speakerProfile: "Pre-Call - Agent (Riya)",
  text: "Let me connect you to the customer now..."
}
```

## Call Scoring Integration

### Rules for Scoring
1. **Score ONLY:** AGENT and USER segments
2. **Context ONLY:** SYSTEM segments (don't score)
3. **Note in Summary:** IVR times, hold durations, call quality issues
4. **Quality Impact:** Background noise affects professionalism scores

### Example Scoring Logic
```typescript
// ✅ DO SCORE
if (segment.speaker === "AGENT" || segment.speaker === "USER") {
  // Apply scoring metrics
  evaluateDialogue(segment);
}

// ❌ DON'T SCORE - Use for context only
if (segment.speaker === "SYSTEM") {
  // Track for summary/context
  if (segment.speakerProfile === "Call on Hold") {
    totalHoldTime += segment.endSeconds - segment.startSeconds;
  }
  if (segment.speakerProfile.startsWith("Background Noise")) {
    callQualityIssues.push(segment);
  }
}
```

## Frontend Display Tips

### Color Coding Suggestion
```typescript
const speakerColors = {
  AGENT: "#3B82F6",      // Blue
  USER: "#10B981",       // Green
  SYSTEM: "#6B7280",     // Gray
};

const getSegmentStyle = (segment) => {
  if (segment.speakerProfile.includes("IVR")) return { color: "#8B5CF6" }; // Purple
  if (segment.speakerProfile.includes("Background")) return { color: "#EF4444", opacity: 0.6 }; // Red, faded
  if (segment.speakerProfile.includes("Hold")) return { color: "#F59E0B" }; // Amber
  return { color: speakerColors[segment.speaker] };
};
```

### Icon Suggestions
- 📞 AGENT: User icon with headset
- 👤 USER: Person icon
- 🤖 IVR: Robot icon
- 🔔 Ringing: Bell icon
- ⏸️ Hold: Pause icon
- 🔇 Background Noise: Muted speaker icon
- 🔢 DTMF: Keypad icon

## Testing Checklist

When testing transcription with enhanced profiling:

- [ ] Agent names detected from introductions
- [ ] User names detected from conversation
- [ ] IVR prompts labeled as SYSTEM (IVR)
- [ ] Ringing detected before call connection
- [ ] Hold music/announcements labeled correctly
- [ ] DTMF tones detected during IVR navigation
- [ ] Background noise only reported when significant
- [ ] Pre-call agent discussions labeled separately
- [ ] All segments have valid startSeconds < endSeconds
- [ ] No gaps in timeline coverage
- [ ] Summary includes IVR/hold time observations
- [ ] Hindi/regional languages transliterated to Roman script
- [ ] PII properly redacted

## Common Patterns

### Typical Call Flow
1. **[0-3s]** SYSTEM (Call Ringing)
2. **[3-15s]** SYSTEM (IVR) - Menu navigation
3. **[15-16s]** SYSTEM (DTMF Tone) - Button press
4. **[16-45s]** SYSTEM (Call on Hold) - Hold music
5. **[45-180s]** AGENT/USER - Conversation
6. **[Intermittent]** SYSTEM (Background Noise) - If significant

### Multi-Agent Call
```typescript
// Transfer scenario
[
  { speaker: "AGENT", speakerProfile: "Agent 1 (Sarah)", ... },
  { speaker: "USER", speakerProfile: "User (John)", ... },
  { speaker: "SYSTEM", speakerProfile: "Call on Hold", text: "[Transferring call...]" },
  { speaker: "AGENT", speakerProfile: "Agent 2 (Mike)", ... }, // New agent
  { speaker: "USER", speakerProfile: "User (John)", ... }, // Same user
]
```

### Conference Call
```typescript
[
  { speaker: "AGENT", speakerProfile: "Agent 1", ... },
  { speaker: "AGENT", speakerProfile: "Agent 2", ... },
  { speaker: "USER", speakerProfile: "User Primary", ... },
  { speaker: "USER", speakerProfile: "User Secondary", ... },
]
```

## API Response Example

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
      "endSeconds": 10,
      "speaker": "SYSTEM",
      "speakerProfile": "IVR",
      "text": "Thank you for calling ETPrime. Press 1 for subscriptions."
    },
    {
      "startSeconds": 10,
      "endSeconds": 11,
      "speaker": "SYSTEM",
      "speakerProfile": "DTMF Tone",
      "text": "[DTMF tone - button press detected]"
    },
    {
      "startSeconds": 11,
      "endSeconds": 25,
      "speaker": "SYSTEM",
      "speakerProfile": "Call on Hold",
      "text": "[Call on hold - music playing]"
    },
    {
      "startSeconds": 25,
      "endSeconds": 38,
      "speaker": "AGENT",
      "speakerProfile": "Agent (Riya)",
      "text": "Hello! You're speaking with Riya from ETPrime. Am I speaking with Mr. Sharma?"
    },
    {
      "startSeconds": 38,
      "endSeconds": 42,
      "speaker": "USER",
      "speakerProfile": "User (Mr. Sharma)",
      "text": "Yes, this is Sharma speaking."
    }
  ],
  "summary": {
    "overview": "Sales call for ETPrime with IVR navigation (7s), hold time (14s), then agent Riya connected with customer Sharma.",
    "keyPoints": [
      "IVR navigation: 7 seconds",
      "Hold time: 14 seconds",
      "Agent identified as Riya",
      "Customer identified as Mr. Sharma"
    ],
    "actions": ["Follow up on subscription renewal"]
  }
}
```

## Support

For questions or issues with the enhanced transcription system:
1. Check `docs/TRANSCRIPTION_PROFILING_GUIDE.md` for detailed documentation
2. Review test cases for expected behavior
3. Verify audio quality meets minimum requirements (16kHz sample rate)
4. Ensure Gemini 2.0 Flash model is configured correctly

Last Updated: October 24, 2025
