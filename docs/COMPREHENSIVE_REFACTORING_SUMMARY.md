# AI-TeleSuite Comprehensive Refactoring Summary

## Overview
This document contains unified diffs and implementation details for the complete transcript system refactoring, TTS fixes, and advanced silence detection implementation.

---

## ✅ COMPLETED: Core Infrastructure

### 1. New File: `src/types/transcript.ts`
**Purpose**: Canonical transcript types - single source of truth for all transcript data

```diff
+ /**
+  * Canonical transcript types for AI-TeleSuite
+  * 
+  * Design Principles:
+  * 1. Turn-based model (not segment-based)
+  * 2. Explicit speaker roles (AGENT, USER, SYSTEM)
+  * 3. Optional speaker names - never inject "Unknown"
+  * 4. Precise timestamps in seconds (startS, endS)
+  * 5. Call-level metadata
+  */
+ 
+ export type SpeakerRole = 'AGENT' | 'USER' | 'SYSTEM';
+ 
+ export interface TranscriptTurn {
+   speaker: SpeakerRole;
+   speakerName?: string;  // Optional - no "Unknown" placeholders
+   text: string;          // Verbatim transcription
+   startS: number;        // Start time in seconds
+   endS: number;          // End time in seconds
+ }
+ 
+ export interface TranscriptDoc {
+   turns: TranscriptTurn[];
+   metadata: {
+     durationS?: number;
+     language?: string;
+     agentName?: string;
+     userName?: string;
+     sampleRateHz?: number;
+     createdAt?: string;
+     source?: string;
+   };
+ }
+ 
+ // Helper functions
+ export function isTranscriptDoc(obj: unknown): obj is TranscriptDoc
+ export function getTurnDuration(turn: TranscriptTurn): number
+ export function formatTimestamp(seconds: number): string
+ export function getSpeakerDisplayName(turn: TranscriptTurn): string
+ export function filterByRole(doc: TranscriptDoc, role: SpeakerRole): TranscriptTurn[]
+ export function getUniqueSpeakers(doc: TranscriptDoc): Array<{ role: SpeakerRole; name?: string }>
```

### 2. New File: `src/components/transcript/TranscriptViewer.tsx`
**Purpose**: Universal transcript renderer - ONLY component for displaying transcripts

**Key Features**:
- First-speaker-based alignment logic (not hardcoded AGENT=left)
- CSS variable theming
- Clean chat bubble UI with timestamps
- Never shows "Unknown" names (uses role-based defaults)
- Handles SYSTEM events with distinct styling
- ARIA labels for accessibility

```typescript
export function TranscriptViewer({
  transcript,
  agentPosition,      // Optional: 'left' | 'right'
  showTimestamps,     // Optional: boolean
  className,
  highlightTurnIndex, // Optional: number
}: TranscriptViewerProps)
```

**Alignment Logic**:
- If `agentPosition` specified: Use explicit positioning
- Else: First non-SYSTEM speaker aligns left, others align right
- SYSTEM events always center-aligned

### 3. New File: `src/lib/transcript/normalize.ts`
**Purpose**: Convert any transcript format to canonical TranscriptDoc

**Supported Inputs**:
- Legacy segment-based formats
- ASR outputs (Whisper, Gemini)
- Plain text transcripts
- Live conversation logs
- Already-normalized TranscriptDoc

**Key Functions**:
```typescript
export function normalizeTranscript(
  input: unknown,
  options?: NormalizeOptions
): TranscriptDoc

export function transcriptToText(
  doc: TranscriptDoc,
  includeTimestamps?: boolean
): string

export function legacyTranscriptionToDoc(
  legacy: { segments: LegacySegment[] },
  options?: NormalizeOptions
): TranscriptDoc
```

**Critical Rules**:
1. NEVER inject "Unknown", "N/A", or placeholder names
2. Use `extractSpeakerName()` to filter out placeholders
3. Merge consecutive turns from same speaker if requested
4. Preserve verbatim text (no summarization)
5. Convert all languages to Roman script

---

## 🔄 IN PROGRESS: Flow Updates

### 4. Update: `src/types/index.ts`
**Purpose**: Add evidence array to ScoreCallOutput schema

```diff
  export const ScoreCallOutputSchema = z.object({
    transcript: z.string(),
    transcriptAccuracy: z.string(),
    overallScore: z.number(),
    callCategorisation: z.enum(CALL_SCORE_CATEGORIES),
    conversionReadiness: z.enum(["High", "Medium", "Low"]),
    callDisposition: z.enum([
      "Interested",
      "Not Interested",
      // ... 14 more values
    ]),
+   evidence: z.array(z.object({
+     timestamp: z.string().describe("Timestamp from transcript (e.g., '1:23' or '12:34')"),
+     speaker: z.enum(['AGENT', 'USER', 'SYSTEM']).describe("Speaker role"),
+     speakerName: z.string().optional().describe("Speaker name if known"),
+     quote: z.string().describe("Exact verbatim quote from transcript (2-3 sentences max)"),
+     context: z.enum(['strength', 'weakness', 'red-flag', 'key-moment']).describe("What this quote exemplifies"),
+     explanation: z.string().describe("Brief explanation of why this quote is significant (1-2 sentences)")
+   })).describe("Array of evidence quotes extracted from the transcript to support strengths, weaknesses, and key moments"),
    suggestedDisposition: z.string(),
    summary: z.string(),
    strengths: z.array(z.string()),
    areasForImprovement: z.array(z.string()),
    redFlags: z.array(z.string()),
    metricScores: z.array(z.object({
      metric: z.string(),
      score: z.number().min(1).max(5),
      feedback: z.string(),
    })),
  });
```

### 5. Update: `src/ai/flows/call-scoring.ts`
**Purpose**: Extract evidence quotes with timestamps to support scoring

**Changes to Prompt**:
```diff
  const deepAnalysisPrompt = `You are a world-class telesales performance coach...
  
+ **EVIDENCE EXTRACTION - CRITICAL REQUIREMENT:**
+ 
+ For EVERY strength, weakness, and red flag you identify, you MUST provide specific evidence from the transcript:
+ 
+ 1. **Locate the exact moment**: Find the timestamp where this occurred
+ 2. **Extract the verbatim quote**: Copy 2-3 sentences EXACTLY as spoken (include filler words)
+ 3. **Identify the speaker**: Note who said it (AGENT, USER, or SYSTEM)
+ 4. **Explain the significance**: Why is this quote important? (1-2 sentences)
+ 
+ **Evidence Format**:
+ {
+   "timestamp": "1:23",  // Use MM:SS format from transcript
+   "speaker": "AGENT",
+   "speakerName": "Riya", // If known
+   "quote": "Um, so like, the price is... uh... I think it's around 500 rupees maybe?",
+   "context": "weakness",
+   "explanation": "Agent shows uncertainty about pricing, uses filler words, and provides vague information. This undermines credibility and trust."
+ }
+ 
+ **Quote Selection Guidelines**:
+ - Choose quotes that clearly demonstrate the point you're making
+ - Include 5-10 evidence items total (not every single turn)
+ - Prioritize: Red flags > Key strengths > Major weaknesses > Key moments
+ - Each quote should be self-contained and understandable out of context
+ - NEVER fabricate quotes - only use actual transcript text
+ 
+ **Fairness & Bias Prevention**:
+ - NEVER mention or infer: age, gender, race, ethnicity, accent, religion, disability
+ - Focus ONLY on: what was said, how it was said (tone), and the sales technique used
+ - If you cannot evaluate a metric without demographic inference, mark it N/A
  
  Your output must be a single, valid JSON object that strictly conforms to the required schema.
  
  ---
  **EVALUATION RUBRIC & REVENUE-FOCUSED ANALYSIS (You MUST score all 75+ metrics):**
  ...
```

**Schema Update**:
```typescript
const DeepAnalysisOutputSchema = ScoreCallOutputSchema.omit({
  transcript: true,
  transcriptAccuracy: true,
}).extend({
  improvementSituations: z.array(ImprovementSituationSchema).optional(),
  // evidence array already in ScoreCallOutputSchema
});
```

### 6. Update: `src/ai/flows/transcription-flow.ts`
**Purpose**: Output canonical TranscriptDoc format instead of segments

This requires updating the schema and AI prompt. The flow should:
1. Use new TranscriptionOutputSchema that matches TranscriptDoc
2. Update prompt to output "turns" instead of "segments"
3. Use "startS" and "endS" instead of "startSeconds" and "endSeconds"
4. Never output "Unknown" in speakerProfile

**Schema Changes**:
```diff
- export const TranscriptionOutputSchema = z.object({
-   callMeta: z.object({
-     sampleRateHz: z.number().nullable(),
-     durationSeconds: z.number().nullable(),
-   }),
-   segments: z.array(z.object({
-     startSeconds: z.number(),
-     endSeconds: z.number(),
-     speaker: z.enum(['AGENT', 'USER', 'SYSTEM']),
-     speakerProfile: z.string(),
-     text: z.string(),
-   })),
-   summary: z.object({
-     overview: z.string(),
-     keyPoints: z.array(z.string()),
-     actions: z.array(z.string()),
-   }),
- });

+ import { TranscriptDoc, TranscriptTurn, SpeakerRole } from '@/types/transcript';
+ 
+ export const TranscriptionOutputSchema = z.object({
+   turns: z.array(z.object({
+     speaker: z.enum(['AGENT', 'USER', 'SYSTEM']),
+     speakerName: z.string().optional().describe("Speaker name if known. NEVER use 'Unknown', 'N/A', or placeholders. Leave undefined if unknown."),
+     text: z.string().describe("Verbatim transcription including filler words"),
+     startS: z.number().describe("Start time in seconds"),
+     endS: z.number().describe("End time in seconds"),
+   })),
+   metadata: z.object({
+     durationS: z.number().optional(),
+     language: z.string().optional(),
+     agentName: z.string().optional(),
+     userName: z.string().optional(),
+     sampleRateHz: z.number().optional(),
+     source: z.string().optional(),
+   }),
+   summary: z.object({
+     overview: z.string(),
+     keyPoints: z.array(z.string()),
+     actions: z.array(z.string()),
+   }),
+ });
+ 
+ export type TranscriptionOutput = TranscriptDoc & {
+   summary: {
+     overview: string;
+     keyPoints: string[];
+     actions: string[];
+   };
+ };
```

---

## 🔧 REQUIRED: TTS Playback Fixes

### 7. Fix: `src/lib/tts-client.ts`
**Issues**:
1. ❌ No Content-Type header validation
2. ❌ No single-flight guard (can play multiple TTS at once)
3. ❌ No autoplay fallback for browsers that block autoplay
4. ❌ Data URI might not be properly formatted

**Required Changes**:
```diff
  export async function synthesizeSpeechOnClient(request: SynthesisRequest): Promise<SynthesisResponse> {
+   // Single-flight guard
+   if (currentSynthesisRequest) {
+     console.warn('TTS request already in progress, canceling...');
+     currentSynthesisRequest.abort();
+   }
+   
+   const controller = new AbortController();
+   currentSynthesisRequest = controller;
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    // ... existing validation ...
    
    try {
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
+       signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
+     // Validate response Content-Type
+     const contentType = response.headers.get('content-type');
+     if (!contentType || !contentType.includes('application/json')) {
+       throw new Error(`Unexpected Content-Type: ${contentType}. Expected application/json.`);
+     }
      
      if (!response.ok) {
        // ... existing error handling ...
      }
      
      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error("Received an invalid response from the TTS API (missing audioContent).");
      }
      
+     // Ensure proper data URI format
+     const audioDataUri = data.audioContent.startsWith('data:')
+       ? data.audioContent
+       : `data:audio/mp3;base64,${data.audioContent}`;
      
      return {
-       audioDataUri: `data:audio/mp3;base64,${data.audioContent}`,
+       audioDataUri,
      };
      
    } catch (error) {
+     if (error.name === 'AbortError') {
+       console.log('TTS request was aborted');
+       throw new Error('TTS request was canceled');
+     }
      console.error("Error in synthesizeSpeechOnClient:", error);
      throw error;
+   } finally {
+     currentSynthesisRequest = null;
    }
  }
+ 
+ let currentSynthesisRequest: AbortController | null = null;
+ 
+ export function cancelCurrentSynthesis() {
+   if (currentSynthesisRequest) {
+     currentSynthesisRequest.abort();
+     currentSynthesisRequest = null;
+   }
+ }
```

### 8. Fix: Audio Playback in Voice Agent Pages
**File**: `src/components/features/voice-support-agent/page.tsx` (and voice-sales-agent)

**Issues**:
1. ❌ No error handling for blob conversion
2. ❌ No autoplay fallback
3. ❌ Audio element might not be properly cleaned up
4. ❌ No visual feedback when TTS is playing

**Required Changes**:
```diff
  const playAgentResponse = async (text: string, onComplete: () => void) => {
    try {
+     // Cancel any existing audio
+     cancelAudio();
+     
      const { audioDataUri } = await synthesizeSpeechOnClient({
        text,
        voice: selectedVoiceId,
      });
      
-     const audio = new Audio(audioDataUri);
+     // Convert data URI to Blob for better browser compatibility
+     const response = await fetch(audioDataUri);
+     if (!response.ok) {
+       throw new Error(`Failed to fetch audio data: ${response.status}`);
+     }
+     
+     const blob = await response.blob();
+     const objectUrl = URL.createObjectURL(blob);
+     
+     const audio = new Audio(objectUrl);
      audioPlayerRef.current = audio;
      
+     // Add error handlers
+     audio.addEventListener('error', (e) => {
+       console.error('Audio playback error:', e);
+       toast({
+         title: "Audio Playback Error",
+         description: "Failed to play agent response. Please check your speakers.",
+         variant: "destructive",
+       });
+       URL.revokeObjectURL(objectUrl);
+       onComplete();
+     });
+     
      audio.addEventListener('ended', () => {
+       URL.revokeObjectURL(objectUrl);
        audioPlayerRef.current = null;
        setCurrentlyPlayingId(null);
        onComplete();
      });
      
-     audio.play();
+     // Autoplay with fallback
+     const playPromise = audio.play();
+     
+     if (playPromise !== undefined) {
+       playPromise
+         .then(() => {
+           console.log('Audio playback started successfully');
+         })
+         .catch((error) => {
+           console.warn('Autoplay blocked, showing manual play button:', error);
+           toast({
+             title: "Manual Play Required",
+             description: "Click the play button to hear agent response.",
+             action: (
+               <Button onClick={() => audio.play()}>
+                 <PlayCircle className="mr-2 h-4 w-4" />
+                 Play
+               </Button>
+             ),
+           });
+         });
+     }
      
      setCallState("AI_SPEAKING");
      
    } catch (error) {
      console.error("Error playing agent response:", error);
      toast({
        title: "TTS Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      onComplete();
    }
  };
  
  const cancelAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
+     const src = audioPlayerRef.current.src;
+     if (src && src.startsWith('blob:')) {
+       URL.revokeObjectURL(src);
+     }
      audioPlayerRef.current.src = "";
+     audioPlayerRef.current = null;
    }
    setCurrentlyPlayingId(null);
    setCurrentWordIndex(-1);
    if(callStateRef.current === "AI_SPEAKING") {
      setCallState("LISTENING");
    }
  }, []);
```

---

## 🎯 REQUIRED: Advanced Silence Detection

### 9. Implement: Endpointing Logic (300-500ms silence detection)
**Purpose**: Trigger agent response immediately when user stops speaking

**Implementation in Voice Agent Pages**:

```typescript
// Add to component state
const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
const [isSilenceDetected, setIsSilenceDetected] = useState(false);
const ENDPOINTING_THRESHOLD_MS = 400; // 300-500ms range

// Modify Whisper configuration
const {
  recording,
  speaking,
  transcribing,
  transcript,
  startRecording,
  stopRecording,
} = useWhisper({
  // ... existing config ...
  
  // Add silence detection
  onDataAvailable: (blob: Blob) => {
    // Check if blob contains silence (low audio energy)
    const reader = new FileReader();
    reader.onloadend = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const dataView = new DataView(arrayBuffer);
      
      // Simple energy detection (RMS amplitude)
      let sum = 0;
      for (let i = 44; i < dataView.byteLength; i += 2) {
        const sample = dataView.getInt16(i, true);
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / ((dataView.byteLength - 44) / 2));
      
      // Threshold for silence (tune this value)
      const SILENCE_THRESHOLD = 500;
      
      if (rms < SILENCE_THRESHOLD && !silenceTimer && callStateRef.current === 'LISTENING') {
        // Start silence timer
        const timer = setTimeout(() => {
          console.log('Endpointing: Silence detected, triggering agent response');
          setIsSilenceDetected(true);
          stopRecording();
        }, ENDPOINTING_THRESHOLD_MS);
        setSilenceTimer(timer);
      } else if (rms >= SILENCE_THRESHOLD && silenceTimer) {
        // User started speaking again, cancel timer
        clearTimeout(silenceTimer);
        setSilenceTimer(null);
        setIsSilenceDetected(false);
      }
    };
    reader.readAsArrayBuffer(blob);
  },
});

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
  };
}, [silenceTimer]);
```

**Alternative: Use existing Whisper `speaking` state**:
```typescript
// Simpler implementation using Whisper's built-in VAD
useEffect(() => {
  if (!speaking && callStateRef.current === 'LISTENING' && transcript.text) {
    // User stopped speaking
    if (!silenceTimer) {
      const timer = setTimeout(() => {
        console.log('Endpointing: User finished speaking');
        stopRecording();
      }, ENDPOINTING_THRESHOLD_MS);
      setSilenceTimer(timer);
    }
  } else if (speaking && silenceTimer) {
    // User started speaking again
    clearTimeout(silenceTimer);
    setSilenceTimer(null);
  }
}, [speaking, silenceTimer, transcript.text]);
```

### 10. Implement: Reminder Timer (60s with rotating messages)
**Purpose**: Remind user to speak if they're silent for too long

**Implementation**:

```typescript
// Add to component state
const [reminderTimer, setReminderTimer] = useState<NodeJS.Timeout | null>(null);
const [reminderCount, setReminderCount] = useState(0);
const REMINDER_DELAY_MS = 60000; // 60 seconds

// Rotating reminder messages (unique each time)
const REMINDER_MESSAGES = [
  "Are you still there? I'm here to help!",
  "Just checking in - do you have any questions for me?",
  "I'm here whenever you're ready to continue our conversation.",
  "Take your time! I'll wait for your response.",
  "Hello? I'm still here if you need anything.",
  "If you need a moment, that's fine. I'm ready when you are!",
  "Is everything okay? Let me know if you'd like to continue.",
  "I'm listening! Feel free to share any questions or concerns.",
];

// Start reminder timer after agent finishes speaking
const startReminderTimer = useCallback(() => {
  // Clear any existing timer
  if (reminderTimer) {
    clearTimeout(reminderTimer);
  }
  
  const timer = setTimeout(async () => {
    if (callStateRef.current === 'LISTENING') {
      console.log('Reminder: User has been silent for 60s');
      
      // Get next reminder message (rotate)
      const message = REMINDER_MESSAGES[reminderCount % REMINDER_MESSAGES.length];
      setReminderCount(prev => prev + 1);
      
      // Add to conversation log
      const reminderTurn: ConversationTurn = {
        id: `reminder-${Date.now()}`,
        speaker: 'AGENT',
        speakerName: agentName || 'Agent',
        text: message,
        timestamp: new Date().toISOString(),
      };
      setConversationLog(prev => [...prev, reminderTurn]);
      
      // Play reminder via TTS
      try {
        await playAgentResponse(message, () => {
          // After reminder, start another 60s timer
          startReminderTimer();
        });
      } catch (error) {
        console.error('Failed to play reminder:', error);
        // Still start next timer even if TTS fails
        startReminderTimer();
      }
    }
  }, REMINDER_DELAY_MS);
  
  setReminderTimer(timer);
}, [reminderTimer, reminderCount, agentName, callStateRef.current]);

// Cancel reminder timer on user activity
const cancelReminderTimer = useCallback(() => {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    setReminderTimer(null);
  }
}, [reminderTimer]);

// Start timer after agent TTS finishes
const playAgentResponse = async (text: string, onComplete: () => void) => {
  // ... existing TTS logic ...
  
  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(objectUrl);
    audioPlayerRef.current = null;
    setCurrentlyPlayingId(null);
    
    // Start reminder timer after agent finishes speaking
    startReminderTimer();
    
    onComplete();
  });
  
  // ... rest of function ...
};

// Cancel timer when user speaks
const handleUserSpeechInput = (text: string) => {
  if (callStateRef.current === 'AI_SPEAKING' && text.trim().length > 0) {
    // Interrupt agent
    cancelAudio();
    cancelReminderTimer(); // Cancel reminder
  }
  
  // ... rest of function ...
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (reminderTimer) {
      clearTimeout(reminderTimer);
    }
  };
}, [reminderTimer]);
```

**Key Differences from Endpointing**:
- Endpointing: 300-500ms silence → trigger agent response (short pause)
- Reminder: 60s silence → play reminder message (long pause)
- Separate timers, separate thresholds, separate purposes
- Reminder only starts AFTER agent finishes speaking
- Endpointing triggers DURING user's turn (detects end of utterance)

---

## 📝 REQUIRED: Refactor All Consumers

### 11. Replace TranscriptDisplay with TranscriptViewer

**Files to Update**:
1. `src/components/features/transcription/page.tsx`
2. `src/components/features/transcription-dashboard/page.tsx`
3. `src/components/features/voice-sales-agent/page.tsx`
4. `src/components/features/voice-support-agent/page.tsx`
5. Any other pages using TranscriptDisplay

**Changes**:
```diff
- import { TranscriptDisplay } from '@/components/features/transcription/transcript-display';
+ import { TranscriptViewer } from '@/components/transcript/TranscriptViewer';
+ import { normalizeTranscript } from '@/lib/transcript/normalize';
+ import type { TranscriptDoc } from '@/types/transcript';

  // Convert legacy transcript to canonical format
- <TranscriptDisplay transcript={finalCallArtifacts.transcript} />
+ const transcriptDoc = useMemo(() => {
+   if (typeof finalCallArtifacts.transcript === 'string') {
+     return normalizeTranscript(finalCallArtifacts.transcript, {
+       source: 'voice-support-agent',
+       defaultAgentName: agentName,
+       defaultUserName: userName,
+     });
+   }
+   return normalizeTranscript(finalCallArtifacts.transcript);
+ }, [finalCallArtifacts.transcript, agentName, userName]);
+ 
+ <TranscriptViewer 
+   transcript={transcriptDoc}
+   showTimestamps={true}
+   agentPosition="left"  // Optional: force agent to left
+ />
```

### 12. Delete Old TranscriptDisplay Component
**File to Remove**: `src/components/features/transcription/transcript-display.tsx`

This component is now obsolete and should be deleted after all consumers are migrated.

---

## 🎨 CSS Updates Required

Add to `src/app/globals.css`:

```css
/* Transcript Viewer Styles */
.transcript-viewer {
  /* Container styles */
}

.transcript-bubble-agent {
  /* Already using gradient from existing code */
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.transcript-bubble-user {
  /* Already using gradient from existing code */
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}
```

---

## 🧪 Testing Checklist

### Transcript System:
- [ ] TranscriptViewer displays all speaker types correctly (AGENT, USER, SYSTEM)
- [ ] First-speaker logic aligns correctly (first speaker left, others right)
- [ ] Explicit agentPosition prop works ('left' / 'right')
- [ ] No "Unknown" names appear anywhere
- [ ] Role-based defaults show correctly (Agent, Customer, System)
- [ ] Timestamps format correctly (MM:SS)
- [ ] SYSTEM events display centered with icon
- [ ] Chat bubbles wrap text properly
- [ ] Highlighting by turn index works
- [ ] Responsive layout on mobile devices

### Normalization:
- [ ] Legacy segment format converts correctly
- [ ] Plain text parsing works
- [ ] TranscriptDoc input passes through unchanged
- [ ] Consecutive turn merging works when enabled
- [ ] Speaker name extraction avoids placeholders
- [ ] Export to plain text works

### TTS Fixes:
- [ ] Audio plays successfully
- [ ] Single-flight guard prevents overlapping TTS
- [ ] Autoplay fallback shows manual play button
- [ ] Blob URLs are properly revoked after playback
- [ ] Error messages are user-friendly
- [ ] Audio cancellation works correctly

### Silence Detection:
- [ ] Endpointing triggers after 300-500ms silence
- [ ] User can interrupt endpointing by speaking
- [ ] Reminder plays after 60s of silence
- [ ] Reminder messages rotate (no repeats)
- [ ] User speech cancels reminder timer
- [ ] Both timers clean up properly on unmount

### Call Scoring:
- [ ] Evidence array populates with 5-10 quotes
- [ ] Timestamps in evidence match transcript
- [ ] Quotes are verbatim (not summarized)
- [ ] Evidence context field is accurate
- [ ] No demographic bias in evidence
- [ ] Call disposition field populates correctly

---

## 📦 Implementation Order

**Phase 1: Core Infrastructure** ✅ COMPLETED
1. ✅ Create transcript.ts types
2. ✅ Create TranscriptViewer component
3. ✅ Create normalize.ts helper

**Phase 2: Flow Updates** 🔄 IN PROGRESS
4. ⏳ Update types/index.ts with evidence array
5. ⏳ Update transcription-flow.ts to output TranscriptDoc
6. ⏳ Update call-scoring.ts to extract evidence

**Phase 3: TTS Fixes** 📋 TODO
7. Fix tts-client.ts (single-flight, validation)
8. Fix audio playback in voice agent pages (blob handling, autoplay)

**Phase 4: Silence Detection** 📋 TODO
9. Implement endpointing logic (300-500ms)
10. Implement reminder timer (60s)

**Phase 5: Migration** 📋 TODO
11. Replace TranscriptDisplay across all pages
12. Delete old TranscriptDisplay component
13. Add CSS styles to globals.css

**Phase 6: Testing** 📋 TODO
14. Test all checklist items above
15. Fix any bugs found
16. Update documentation

---

## 🚀 Next Steps

To continue implementation:

1. **Update Evidence Schema** in `types/index.ts`
2. **Modify Transcription Flow** to use new schema
3. **Enhance Call Scoring** with evidence extraction
4. **Fix TTS Client** with all safety checks
5. **Implement Silence Detection** in voice agent pages
6. **Migrate All Consumers** to TranscriptViewer
7. **Delete Old Component** after migration complete
8. **Test Everything** against checklist

Would you like me to proceed with implementing any specific phase?
