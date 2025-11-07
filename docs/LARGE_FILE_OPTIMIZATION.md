# Large Audio File Processing - Optimization Guide

## Current Implementation Status

### File Size Limits
- **Maximum File Size**: 100MB per file (aligned with Vercel limits)
- **Large File Threshold**: 50MB (warning displayed to users)
- **API Timeout**: 300 seconds (5 minutes) for Vercel Hobby plan

### Current Cost Optimization
1. **Model Selection**: Using Gemini 2.0 Flash (cost-effective) with 1.5 Pro fallback
2. **Retry Manager**: Smart retry logic with exponential backoff
3. **Batch Processing**: Sequential processing to avoid overwhelming API
4. **Error Handling**: Graceful degradation with detailed error messages

---

## Recommendations for Files > 100MB

### Option 1: Audio Preprocessing & Compression (RECOMMENDED)
**Best for maintaining quality while reducing costs**

```typescript
// Implement audio compression before upload
async function compressAudio(file: File): Promise<File> {
  // Use ffmpeg.wasm or similar library
  // Target: Compress to ~64kbps for speech (maintains clarity)
  // Expected compression: 50-70% size reduction
  // Quality: Minimal impact on transcription accuracy
}
```

**Benefits:**
- Reduces API costs by 50-70%
- Faster upload times
- Better user experience
- No accuracy loss for speech transcription

**Implementation Steps:**
1. Install `@ffmpeg/ffmpeg` package
2. Add compression step in `fileToDataUrl` utility
3. Add UI toggle for "Compress large files" option
4. Cache compressed files in browser storage

### Option 2: Audio Chunking Strategy
**Best for very long recordings (>1 hour)**

```typescript
interface ChunkStrategy {
  chunkDuration: number; // 10 minutes per chunk
  overlapSeconds: number; // 5 seconds overlap for context
  parallelChunks: number; // Process 2-3 chunks in parallel
}

async function processInChunks(audioFile: File): Promise<TranscriptionOutput> {
  // 1. Split audio into 10-minute chunks with 5s overlap
  // 2. Process chunks in parallel (2-3 at a time)
  // 3. Merge results with overlap handling
  // 4. Reconcile speaker identities across chunks
}
```

**Benefits:**
- Can handle files of any size
- Parallel processing = faster results
- Better memory management
- Resilient to individual chunk failures

**Challenges:**
- Speaker diarization consistency across chunks
- Requires audio splitting library
- More complex error handling

### Option 3: Streaming Transcription (FUTURE)
**Best for real-time or very large files**

```typescript
// Use WebSocket or Server-Sent Events
async function streamTranscription(audioFile: File) {
  // 1. Stream audio chunks to server
  // 2. Process chunks as they arrive
  // 3. Update UI with incremental results
  // 4. Final consolidation when complete
}
```

**Benefits:**
- Real-time feedback to users
- No file size limits
- Better for live call transcription
- Progressive enhancement

**Requirements:**
- WebSocket infrastructure
- Streaming API support from AI provider
- More complex client-side implementation

---

## Cost Optimization Strategies

### 1. Smart Model Selection
```typescript
function selectOptimalModel(fileSize: number, duration: number): string {
  if (fileSize < 10 * 1024 * 1024) {
    // Small files: Use Flash for speed & cost
    return 'gemini-2.0-flash';
  } else if (fileSize < 50 * 1024 * 1024) {
    // Medium files: Flash with longer timeout
    return 'gemini-2.0-flash';
  } else {
    // Large files: Consider compression first
    return 'gemini-2.0-flash'; // Still use Flash after compression
  }
}
```

### 2. Caching Strategy
```typescript
interface TranscriptionCache {
  audioHash: string; // MD5 of audio file
  result: TranscriptionOutput;
  timestamp: number;
  expiresAt: number; // 7 days
}

// Check cache before making API call
async function getCachedOrTranscribe(audioFile: File): Promise<TranscriptionOutput> {
  const hash = await getFileHash(audioFile);
  const cached = await getCachedResult(hash);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  
  const result = await transcribeAudio({ audioDataUri });
  await cacheResult(hash, result);
  return result;
}
```

### 3. Queue Management
```typescript
interface QueuePriority {
  fileSize: number;
  userTier: 'free' | 'paid' | 'enterprise';
  estimatedCost: number;
  priority: number;
}

// Process smaller files first for better UX
function sortByPriority(files: File[]): File[] {
  return files.sort((a, b) => {
    // Prioritize: smaller size, higher user tier
    const aPriority = calculatePriority(a);
    const bPriority = calculatePriority(b);
    return bPriority - aPriority;
  });
}
```

### 4. Cost Monitoring
```typescript
interface CostTracker {
  dailyUsage: number; // Total API tokens used
  monthlyBudget: number; // Maximum spend limit
  costPerFile: Map<string, number>; // Track per-file costs
  
  async trackUsage(fileId: string, tokens: number): Promise<void>;
  async checkBudget(): Promise<boolean>; // Stop if over budget
  async generateReport(): Promise<CostReport>;
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (Week 1)
1. ✅ **Batch Progress Display** - Already implemented
2. ✅ **Enhanced Transcript Display** - Color-coded dialogue boxes
3. 🔄 **Audio Compression** - Implement client-side compression
4. 🔄 **Caching Layer** - Add result caching for repeated files

### Phase 2: Scalability (Week 2-3)
1. 🔄 **Chunking Strategy** - Implement for files >100MB
2. 🔄 **Advanced Queue Management** - Priority-based processing
3. 🔄 **Cost Monitoring Dashboard** - Track usage and costs
4. 🔄 **Progressive Enhancement** - Better UX for large files

### Phase 3: Advanced Features (Month 2)
1. 🔄 **Streaming Transcription** - Real-time processing
2. 🔄 **Multi-language Optimization** - Specialized models per language
3. 🔄 **Speaker Recognition** - Voice fingerprinting for consistency
4. 🔄 **Export Options** - Multiple format exports (SRT, VTT, DOCX)

---

## Testing Recommendations

### Large File Test Suite
```typescript
describe('Large File Processing', () => {
  test('50MB file completes within 5 minutes', async () => {
    const file = generateTestFile(50 * 1024 * 1024);
    const result = await transcribeAudio(file);
    expect(result.segments).toHaveLength(greaterThan(0));
  });

  test('Compression reduces size by 60%', async () => {
    const file = generateTestFile(100 * 1024 * 1024);
    const compressed = await compressAudio(file);
    expect(compressed.size).toBeLessThan(file.size * 0.4);
  });

  test('Chunking maintains speaker consistency', async () => {
    const file = generateLongTestFile(3600); // 1 hour
    const result = await processInChunks(file);
    // Verify same speaker ID across chunks
    expect(result.segments[0].speaker).toBe(result.segments[100].speaker);
  });
});
```

---

## Monitoring & Alerts

### Key Metrics to Track
1. **Average Processing Time** by file size
2. **Success Rate** for files >50MB
3. **API Cost** per transcription
4. **User Satisfaction** (completion rate, retry rate)
5. **Error Rate** by error type

### Alert Thresholds
```typescript
const ALERT_THRESHOLDS = {
  processingTime: 4 * 60 * 1000, // 4 minutes (80% of timeout)
  errorRate: 0.05, // 5% error rate
  dailyCost: 100, // $100 daily spend
  queueLength: 50, // 50 files waiting
};
```

---

## User Communication

### UI Messages
```typescript
const FILE_SIZE_MESSAGES = {
  under50MB: "✅ Optimal file size. Processing will take 2-5 minutes.",
  between50and100MB: "⚠️ Large file detected. Processing may take 5-15 minutes. Consider compressing for faster results.",
  over100MB: "🚫 File exceeds 100MB limit. Please compress the audio or split into smaller segments.",
  compressionAvailable: "💡 Enable compression to reduce processing time and costs by 60%",
};
```

### Progress Messages
```typescript
const PROGRESS_MESSAGES = {
  10: "Converting audio format...",
  30: "Uploading to AI service...",
  50: "Analyzing audio content...",
  70: "Generating transcript...",
  90: "Finalizing speaker labels...",
  100: "Complete! ✅",
};
```

---

## Cost Analysis

### Current Cost Structure (Gemini 2.0 Flash)
- **Audio Input**: ~$0.025 per minute
- **Text Output**: ~$0.10 per 1M tokens
- **Average 1-hour call**: $1.50 - $2.50

### Optimization Impact
- **With Compression (64kbps)**: 60% cost reduction → $0.60 - $1.00
- **With Caching**: 80% reduction for repeated files
- **With Chunking**: Better parallelization, no cost change but faster

### ROI Calculation
```
Monthly Cost Without Optimization: 
- 1000 files × 30 min avg × $0.75 = $22,500

Monthly Cost With Optimization:
- 1000 files × 30 min avg × $0.30 = $9,000
- Savings: $13,500/month (60% reduction)
```

---

## Conclusion

The current implementation handles files up to 100MB effectively. For larger files:
1. **Immediate**: Implement audio compression (60% cost savings)
2. **Short-term**: Add caching layer (80% savings on repeated files)
3. **Long-term**: Implement chunking for unlimited file sizes

All optimizations maintain transcription accuracy while improving user experience and reducing costs.
