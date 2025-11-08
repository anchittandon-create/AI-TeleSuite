# Pre-Call Detection and Filtering

## Overview

The transcript system now automatically detects and separates **pre-call content** (IVR, hold music, background noise, peer chatter) from **interactive conversation** (agent-customer dialogue). This ensures:

1. **Accurate Scoring**: Pre-call content is excluded from performance metrics
2. **Clear UI Separation**: Pre-call appears in collapsible section above main transcript
3. **Better Navigation**: "Call Started" divider marks the beginning of actual conversation
4. **Analytics Ready**: Track queue times, IVR duration, and hold times separately

## Profile System

### Interactive Profiles (Included in Scoring)
- `agent`: Call center agent
- `customer`: Customer/user/caller

### Pre-Call Profiles (Excluded from Scoring)
- `ivr`: Interactive Voice Response system
- `system`: System announcements, beeps, tones
- `hold`: Hold music, waiting messages
- `waiting`: Queue waiting state
- `noise`: Background noise, static, unclear audio
- `peerAgent`: Other agents (internal chatter before pickup)
- `supervisor`: Supervisor check-ins before call start
- `other`: Unknown/miscellaneous non-interactive content

## Type System

### TranscriptTurn Interface

```typescript
export interface TranscriptTurn {
  // NEW: Profile system
  profile: Profile;              // Detailed profile type
  baseRole: BaseRole;            // 'agent' | 'user' (for colors/scoring)
  
  // LEGACY: Kept for backward compatibility
  speaker: SpeakerRole;          // 'AGENT' | 'USER' | 'SYSTEM'
  
  // Speaker identification
  speakerName?: string;
  
  // Content
  text: string;
  
  // Timing (millisecond precision)
  startMs?: number;              // NEW: millisecond start time
  endMs?: number;                // NEW: millisecond end time
  
  // LEGACY: Second precision (kept for compatibility)
  startS: number;
  endS: number;
  
  // Metadata
  confidence?: number;           // Speech recognition confidence (0-1)
  channel?: number | string;     // Audio channel identifier
}
```

### TranscriptDoc Interface

```typescript
export interface TranscriptDoc {
  turns: TranscriptTurn[];
  
  // NEW: Pre-call detection metadata
  callStartMs?: number;          // When actual conversation started
  preCallDurationMs?: number;    // Duration of pre-call section
  source?: string;               // Source of transcript
  
  metadata: {
    durationS?: number;
    language?: string;
    agentName?: string;
    userName?: string;
    source?: string;
    createdAt?: string;
    // ... other fields
  };
}
```

## Automatic Detection

The `normalizeTranscript()` function automatically detects pre-call sections:

```typescript
import { normalizeTranscript } from '@/lib/transcript/normalize';

// Automatically detects pre-call and populates metadata
const doc = normalizeTranscript(rawTranscript);

console.log(doc.callStartMs);       // e.g., 23450 (23.45 seconds)
console.log(doc.preCallDurationMs); // e.g., 23450 (23.45 seconds of IVR/hold)
```

### Detection Logic

The system finds the **first interactive turn** (agent or customer speaking) and marks everything before it as pre-call:

1. Walk through turns in order
2. Find first turn where `isInteractiveProfile(turn.profile) === true`
3. Set `callStartMs` to that turn's start time
4. Calculate `preCallDurationMs` as time from first turn to call start

### Example Detection

```typescript
const turns = [
  { profile: 'ivr', text: 'Press 1 for sales...', startMs: 0, endMs: 5000 },
  { profile: 'hold', text: '[Hold Music]', startMs: 5000, endMs: 15000 },
  { profile: 'system', text: '[Connecting...]', startMs: 15000, endMs: 18000 },
  { profile: 'agent', text: 'Hello, how can I help?', startMs: 18000, endMs: 20000 }, // ← CALL STARTS HERE
  { profile: 'customer', text: 'I need help with...', startMs: 20000, endMs: 23000 },
];

// Result:
// callStartMs = 18000 (18 seconds)
// preCallDurationMs = 18000 (18 seconds of pre-call)
```

## Filtering for Scoring

Use `filterForScoring()` to remove pre-call content before analysis:

```typescript
import { filterForScoring } from '@/lib/transcript/normalize';

// Original doc includes pre-call content
const fullDoc = normalizeTranscript(rawTranscript);

// Filtered doc contains only interactive conversation
const scoringDoc = filterForScoring(fullDoc);

// Now score only the actual conversation
const score = await scoreCall(scoringDoc);
```

### What Gets Filtered

- ❌ `ivr`, `system`, `hold`, `waiting`, `noise` → **Removed**
- ❌ `peerAgent`, `supervisor`, `other` → **Removed**
- ✅ `agent`, `customer` → **Kept for scoring**

## Helper Functions

### isInteractiveProfile(profile)

Check if a profile represents interactive conversation:

```typescript
import { isInteractiveProfile } from '@/types/transcript';

isInteractiveProfile('agent');      // true
isInteractiveProfile('customer');   // true
isInteractiveProfile('ivr');        // false
isInteractiveProfile('hold');       // false
isInteractiveProfile('noise');      // false
```

### isPreCallProfile(profile)

Check if a profile represents pre-call content:

```typescript
import { isPreCallProfile } from '@/types/transcript';

isPreCallProfile('ivr');        // true
isPreCallProfile('hold');       // true
isPreCallProfile('system');     // true
isPreCallProfile('agent');      // false
isPreCallProfile('customer');   // false
```

### legacyRoleToProfile(speaker)

Convert legacy speaker roles to new profile system:

```typescript
import { legacyRoleToProfile } from '@/types/transcript';

legacyRoleToProfile('AGENT');   // { profile: 'agent', baseRole: 'agent' }
legacyRoleToProfile('USER');    // { profile: 'customer', baseRole: 'user' }
legacyRoleToProfile('SYSTEM');  // { profile: 'system', baseRole: 'user' }
```

## Manual Profile Assignment

When creating turns manually (e.g., in voice agents), assign the appropriate profile:

```typescript
const turn: TranscriptTurn = {
  profile: 'agent',           // Use specific profile
  baseRole: 'agent',          // 'agent' or 'user' for colors
  speaker: 'AGENT',           // Legacy field
  speakerName: 'John',
  text: 'How can I help you?',
  startS: 0,
  endS: 2,
  startMs: 0,
  endMs: 2000,
};
```

### Profile Assignment Guidelines

**For IVR/Automated Systems:**
```typescript
{ profile: 'ivr', baseRole: 'user', speaker: 'SYSTEM' }
```

**For Hold/Queue:**
```typescript
{ profile: 'hold', baseRole: 'user', speaker: 'SYSTEM' }
```

**For Background Noise:**
```typescript
{ profile: 'noise', baseRole: 'user', speaker: 'SYSTEM' }
```

**For Internal Chatter (before call pickup):**
```typescript
{ profile: 'peerAgent', baseRole: 'agent', speaker: 'AGENT' }
```

**For Actual Agent:**
```typescript
{ profile: 'agent', baseRole: 'agent', speaker: 'AGENT' }
```

**For Customer:**
```typescript
{ profile: 'customer', baseRole: 'user', speaker: 'USER' }
```

## UI Rendering (TranscriptViewer)

*Note: UI components are currently being updated to support pre-call rendering.*

The TranscriptViewer component will render pre-call content in a collapsible section:

```tsx
<TranscriptViewer 
  doc={transcript}
  showPreCall={true}           // Show pre-call section (default: true)
  showCallStartDivider={true}  // Show "Call Started" divider (default: true)
/>
```

### UI Features (Coming Soon)

1. **Pre-Call Section**:
   - Collapsible by default if duration ≥ 15 seconds
   - Duration badge: "Pre-Call (00:23)"
   - Profile chips for each turn (IVR, Hold, Noise, etc.)
   - Lighter/muted styling

2. **Call Started Divider**:
   - Full-width separator with icon
   - Label: "Call Started — mm:ss"
   - Anchor ID `#call-start` for navigation
   - Positioned before first interactive turn

3. **Navigation**:
   - Jump to call start: `window.location.hash = '#call-start'`
   - Batch table "Jump" buttons link to `#call-start` anchor

## Migration Guide

### Backward Compatibility

The system maintains full backward compatibility:

- **Legacy fields preserved**: `speaker`, `startS`, `endS` still work
- **Automatic detection**: Pre-call detection runs automatically
- **Opt-in filtering**: Use `filterForScoring()` only where needed
- **Gradual adoption**: Old code continues working without changes

### Updating Existing Code

**Before (old approach):**
```typescript
const doc = normalizeTranscript(raw);
const score = await scoreCall(doc); // Includes pre-call content ❌
```

**After (recommended):**
```typescript
const doc = normalizeTranscript(raw);        // Auto-detects pre-call
const scoringDoc = filterForScoring(doc);    // Remove pre-call
const score = await scoreCall(scoringDoc);   // Accurate scoring ✅
```

### Example: Call Scoring Route

```typescript
// src/app/api/call-scoring/route.ts
import { normalizeTranscript, filterForScoring } from '@/lib/transcript/normalize';

export async function POST(req: Request) {
  const { transcript } = await req.json();
  
  // Normalize and detect pre-call
  const fullDoc = normalizeTranscript(transcript);
  
  // Filter for scoring (removes IVR, hold, noise)
  const scoringDoc = filterForScoring(fullDoc);
  
  // Score only the actual conversation
  const result = await scoreCall(scoringDoc);
  
  return Response.json(result);
}
```

## Benefits

### 1. Accurate Performance Metrics
- Hold music doesn't count as "agent silence"
- IVR messages don't affect agent scoring
- Queue time tracked separately from handle time

### 2. Better User Experience
- Clear visual separation
- Easy navigation to actual conversation
- Collapsible pre-call section reduces clutter

### 3. Analytics Ready
- Track average queue time
- Measure IVR effectiveness
- Identify hold time patterns
- Compare pre-call vs in-call duration

### 4. Consistent Behavior
- Same logic across all transcript sources
- Automatic detection (no manual tagging)
- Unified filtering for scoring

## Testing

### Manual Profile Detection
```typescript
import { detectPreCall } from '@/lib/transcript/normalize';

const doc = {
  turns: [
    { profile: 'ivr', startMs: 0, endMs: 5000 },
    { profile: 'agent', startMs: 5000, endMs: 8000 },
  ],
  metadata: {},
};

const result = detectPreCall(doc);
console.log(result);
// {
//   callStartIndex: 1,
//   callStartMs: 5000,
//   preCallDurationMs: 5000
// }
```

### Verify Filtering
```typescript
import { filterForScoring } from '@/lib/transcript/normalize';

const doc = {
  turns: [
    { profile: 'ivr', text: 'Press 1...' },
    { profile: 'hold', text: '[Hold]' },
    { profile: 'agent', text: 'Hello!' },
    { profile: 'customer', text: 'Hi' },
  ],
  metadata: {},
};

const filtered = filterForScoring(doc);
console.log(filtered.turns.length); // 2 (only agent + customer)
```

## Future Enhancements

- [ ] AI-powered profile classification (auto-detect IVR vs agent)
- [ ] Per-profile analytics dashboard
- [ ] Custom profile definitions per organization
- [ ] Pre-call summary extraction
- [ ] Hold time optimization recommendations
- [ ] IVR effectiveness metrics

## Related Files

- **Types**: `src/types/transcript.ts`
- **Normalization**: `src/lib/transcript/normalize.ts`
- **UI Component**: `src/components/transcript/TranscriptViewer.tsx` (in progress)
- **Styling**: `src/styles/transcript.css`, `src/styles/transcript-theme.ts`

## Questions?

See also:
- [Transcription Enhancement Summary](./TRANSCRIPTION_ENHANCEMENT_SUMMARY.md)
- [Universal Transcript Implementation](./UNIVERSAL_TRANSCRIPT_IMPLEMENTATION.md)
- [Voice Activity Detection](./VOICE_ACTIVITY_DETECTION.md)
