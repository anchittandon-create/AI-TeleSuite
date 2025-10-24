# Universal Transcript System Implementation Guide

## ✅ Completed

### 1. Enhanced Transcription Prompt
**File**: `src/ai/flows/transcription-flow.ts`

**Changes Made**:
- Added **CRITICAL TRANSCRIPTION RULES** section emphasizing:
  - VERBATIM transcription (word-for-word, NO paraphrasing)
  - Include ALL filler words, repetitions, false starts
  - NO summarizing or cleaning up dialogue
  - Maintain natural speech patterns including grammar errors
- Enhanced **ENGLISH ROMAN SCRIPT ONLY** rules:
  - Zero tolerance for non-Roman scripts
  - Exact phonetic transliteration
  - Preserve code-switching naturally
  - Keep colloquial expressions
- Added detailed examples of verbatim transcription
- Added mixed-language code-switching examples

### 2. Transcript Feedback Schema
**File**: `src/types/index.ts`

**Changes Made**:
```typescript
// Added TranscriptFeedbackSchema
export const TranscriptFeedbackSchema = z.object({
  rating: z.enum(['excellent', 'good', 'fair', 'poor']),
  accuracyIssues: z.boolean(),
  speakerAttributionIssues: z.boolean(),
  languageIssues: z.boolean(),
  comments: z.string().optional(),
  timestamp: z.string(),
  reviewedBy: z.string().optional(),
});

// Updated ActivityLogEntry to include feedback
export interface ActivityLogEntry {
  // ... existing fields
  userFeedback?: TranscriptFeedback; // NEW
}

// Updated TranscriptionActivityDetails to include audio
export interface TranscriptionActivityDetails {
  fileName: string;
  transcriptionOutput: TranscriptionOutput;
  audioDataUri?: string; // NEW - for playback
  error?: string;
}
```

### 3. Feedback UI Component
**File**: `src/components/features/transcript-feedback.tsx`

**Created**:
- `TranscriptFeedbackComponent` - Full feedback form with:
  - Quality rating (excellent/good/fair/poor)
  - Issue type checkboxes (accuracy, speaker attribution, language)
  - Comments textarea
  - Saves to localStorage activities
- `TranscriptFeedbackBadge` - Compact display for tables/lists

### 4. Transcript Utility Functions
**File**: `src/lib/transcript-utils.ts`

**Created Helper Functions**:
```typescript
- formatTranscriptSegments(output) // Converts segments to string format
- extractPlainText(output) // Plain text without timestamps
- formatTranscriptSummary(output) // Formatted summary
- formatFullTranscript(output) // Complete with summary
- getTranscriptMetadata(output) // Duration, counts, etc.
```

## 🚧 TODO: Integration Work Needed

### Phase 1: Update Transcription Page
**File**: `src/app/(main)/transcription/page.tsx` (or similar)

**Required Changes**:
1. When saving to activity log, include `audioDataUri`:
```typescript
const activityDetails: TranscriptionActivityDetails = {
  fileName: file.name,
  transcriptionOutput: result,
  audioDataUri: audioDataUri, // ADD THIS
  error: undefined,
};
```

### Phase 2: Update Transcription Dashboard
**File**: `src/components/features/transcription-dashboard/dashboard-table.tsx`

**Required Changes**:
1. Remove references to old fields (`accuracyAssessment`, `diarizedTranscript`)
2. Use `formatTranscriptSegments()` to convert segments to string
3. Add feedback column to table
4. Add feedback component to detail dialog

**Example Updates**:
```typescript
// OLD (remove these)
item.details.transcriptionOutput?.accuracyAssessment
item.details.transcriptionOutput?.diarizedTranscript

// NEW (use these)
import { formatTranscriptSegments } from '@/lib/transcript-utils';
const transcript = formatTranscriptSegments(item.details.transcriptionOutput);

// Add feedback column
<TableHead>Feedback</TableHead>
// ...
<TableCell>
  <TranscriptFeedbackBadge feedback={item.userFeedback} />
</TableCell>

// Add feedback component in dialog
<TranscriptFeedbackComponent
  transcriptId={selectedItem.id}
  activityId={selectedItem.id}
  existingFeedback={selectedItem.userFeedback}
/>
```

### Phase 3: Update Call Scoring Dashboard
**File**: `src/components/features/call-scoring-dashboard/*.tsx`

**Required Changes**:
1. Add feedback component for transcripts in call scoring reports
2. Add feedback badge in table view
3. Use same universal feedback system

**Add to Detail View**:
```typescript
<div className="mt-4">
  <h4>Transcript Quality Feedback</h4>
  <TranscriptFeedbackComponent
    transcriptId={item.id}
    activityId={item.id}
    existingFeedback={item.userFeedback}
  />
</div>
```

### Phase 4: Update Combined Analysis Dashboard
**File**: `src/components/features/combined-call-analysis/*.tsx`

**Required Changes**:
1. Add feedback for each individual call transcript
2. Show aggregated feedback stats in batch view

### Phase 5: Update All API Routes
Ensure consistent transcription format across all API routes:

**Files to Check**:
- `src/app/api/transcription/route.ts` ✅ Already uses `transcribeAudio`
- `src/app/api/call-scoring/route.ts` ✅ Already uses `transcribeAudio`
- `src/app/api/combined-call-analysis/route.ts` - Check if it uses transcription

### Phase 6: Update Data Analysis Flow
**File**: `src/app/(main)/data-analysis/page.tsx`

If data analysis uses transcription, ensure it uses the same `transcribeAudio` function.

## 📋 Testing Checklist

Once integration is complete, test:

- [ ] Upload audio file for transcription
- [ ] Verify transcript is word-for-word verbatim
- [ ] Check Hindi/Hinglish is in Roman script only
- [ ] Verify filler words (um, uh) are included
- [ ] Test feedback component submission
- [ ] Verify feedback persists in localStorage
- [ ] Check feedback displays in table view
- [ ] Verify feedback shows in detail dialog
- [ ] Test call scoring with transcription
- [ ] Verify combined analysis uses same transcription
- [ ] Export transcript to PDF/text
- [ ] Play back audio from stored dataUri
- [ ] Test all dashboards show feedback consistently

## 🔑 Key Implementation Points

### 1. Universal Transcription Function
**Always use**: `import { transcribeAudio } from '@/ai/flows/transcription-flow'`

This ensures:
- Same prompt everywhere
- Same quality standards
- Same retry logic
- Same output format

### 2. Feedback Storage Pattern
```typescript
// When updating activity log
const activities = JSON.parse(localStorage.getItem('activities') || '[]');
const index = activities.findIndex(a => a.id === activityId);
if (index !== -1) {
  activities[index].userFeedback = feedback;
  localStorage.setItem('activities', JSON.stringify(activities));
}
```

### 3. Display Pattern
```typescript
// In table
<TranscriptFeedbackBadge feedback={item.userFeedback} />

// In detail view
<TranscriptFeedbackComponent
  transcriptId={item.id}
  activityId={item.id}
  existingFeedback={item.userFeedback}
  onFeedbackSubmit={(feedback) => {
    // Optional: handle feedback submission
    console.log('Feedback submitted:', feedback);
  }}
/>
```

### 4. Transcript Conversion
```typescript
import { formatTranscriptSegments, formatFullTranscript } from '@/lib/transcript-utils';

// For display
const transcriptString = formatTranscriptSegments(transcriptionOutput);

// For export (with summary)
const fullTranscript = formatFullTranscript(transcriptionOutput);

// For plain text copy
const plainText = extractPlainText(transcriptionOutput);
```

## 📊 Expected Output Format

### Transcription Output Structure
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
      "startSeconds": 25,
      "endSeconds": 38,
      "speaker": "AGENT",
      "speakerProfile": "Agent (Riya)",
      "text": "Hello, um... you're speaking with Riya from... uh... ETPrime. Am I speaking with, uh, Mr. Sharma?"
    }
  ],
  "summary": {
    "overview": "...",
    "keyPoints": ["..."],
    "actions": ["..."]
  }
}
```

### Feedback Structure
```json
{
  "rating": "good",
  "accuracyIssues": false,
  "speakerAttributionIssues": false,
  "languageIssues": false,
  "comments": "Great transcription, captured all filler words correctly",
  "timestamp": "2025-10-24T10:30:00Z",
  "reviewedBy": "Anchit"
}
```

## 🎯 Benefits of This System

1. **Verbatim Accuracy**: Every word captured exactly as spoken
2. **Universal Quality**: Same transcription logic everywhere
3. **User Feedback Loop**: Continuous quality improvement
4. **Roman Script Only**: Consistent format, easy to read and search
5. **Comprehensive Audio Analysis**: IVR, hold, background noise all tracked
6. **Feedback Analytics**: Can track quality trends over time

## 📝 Next Steps

1. Complete Phase 1-6 integrations above
2. Test thoroughly with real audio files
3. Gather initial feedback from users
4. Iterate based on feedback
5. Consider adding:
   - Feedback analytics dashboard
   - Automated quality metrics
   - A/B testing different prompts
   - Fine-tuning based on user corrections

---

**Status**: Core transcription logic complete, UI integrations pending
**Priority**: High - ensures consistent quality across entire app
**Effort**: Medium - mostly UI integration work, logic is done
