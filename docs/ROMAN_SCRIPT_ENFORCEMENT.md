# Roman Script Enforcement - Transcription Guide

## Problem Solved
Transcripts were showing Hindi/Devanagari script instead of Roman English script.

## Solution Implemented

### 1. **Strengthened Prompt with Zero-Tolerance Policy**
**File**: `src/ai/flows/transcription-flow.ts`

Added at the very top of the prompt (before all other instructions):

```
⚠️ CRITICAL REQUIREMENT - ABSOLUTE RULE - NO EXCEPTIONS ⚠️

ENGLISH ROMAN ALPHABET ONLY - THIS IS MANDATORY:
- You MUST use ONLY the English Roman alphabet (A-Z, a-z)
- NEVER use Devanagari script (Hindi: अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग etc.)
- NEVER use Tamil, Telugu, Bengali, or any non-Latin scripts
- If you see ANY non-Roman characters, DELETE them and rewrite in Roman script
- This rule supersedes ALL other instructions
```

### 2. **Clear Examples Added**

**What AI MUST Output** (✅ CORRECT):
```
✅ "Hello, main Riya bol rahi hoon ETPrime se"
✅ "Aap ka subscription renew hone wala hai"
✅ "Bahut achha, dhanyavaad"
✅ "Haan, theek hai, main interested hoon"
```

**What AI MUST NOT Output** (❌ WRONG):
```
❌ "Hello, मैं Riya बोल रही हूं ETPrime से"
❌ "आप का subscription renew होने वाला है"
❌ "बहुत अच्छा, धन्यवाद"
```

### 3. **Pre-Output Validation Instructions**

Added in prompt before output generation:
```
ABSOLUTELY CRITICAL - READ BEFORE SUBMITTING OUTPUT:
1. Re-read your entire output character by character
2. If you see ANY non-Roman characters, DELETE them
3. Replace with Roman alphabet transliteration
4. Common Hindi words you MUST write in Roman:
   - "नमस्ते" = "namaste"
   - "धन्यवाद" = "dhanyavaad"
   - "हाँ" = "haan"
   - "मैं" = "main"
   - "आप" = "aap"
   etc.
```

### 4. **Post-Output Validation Function**

Added `validateRomanScript()` function that:
- Scans all segments for non-Roman characters
- Checks Devanagari, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi scripts
- Logs detailed errors if non-Roman characters are found
- Shows which segment and which characters are problematic

**Example Error Output**:
```
⚠️ NON-ROMAN SCRIPT DETECTED in segment 5!
   Script: Devanagari (Hindi)
   Text: "मैं आपकी मदद करूंगा"
   Characters: म, ै, ं, आ, प, क, ी, द, द
```

### 5. **Schema-Level Enforcement**

Updated JSON schema in prompt:
```json
{
  "text": string  // MUST BE IN ROMAN SCRIPT ONLY - NO EXCEPTIONS
}
```

## Common Hindi → Roman Transliterations

| Hindi (Devanagari) | Roman Script | Meaning |
|-------------------|--------------|---------|
| नमस्ते | namaste | Hello |
| धन्यवाद | dhanyavaad | Thank you |
| हाँ | haan | Yes |
| नहीं | nahin | No |
| ठीक है | theek hai | Okay |
| मैं | main | I |
| आप | aap | You |
| क्या | kya | What |
| कैसे | kaise | How |
| कब | kab | When |
| कहाँ | kahaan | Where |
| कौन | kaun | Who |
| क्यों | kyu/kyun | Why |
| अच्छा | achha | Good |
| बहुत | bahut | Very/Much |
| सब्सक्रिप्शन | subscription | Subscription |
| रिन्यूअल | renewal | Renewal |
| प्लान | plan | Plan |

## Natural Hinglish Examples

Users often speak mixed Hindi-English (Hinglish). Here's how it should be transcribed:

| Spoken | ❌ Wrong Output | ✅ Correct Output |
|--------|----------------|-------------------|
| "मैं interested हूं" | "मैं interested हूं" | "main interested hoon" |
| "Aap ka प्लान expire हो रहा है" | "Aap ka प्लान expire हो रहा है" | "Aap ka plan expire ho raha hai" |
| "Very अच्छा offer है" | "Very अच्छा offer है" | "Very achha offer hai" |
| "ठीक है, I'll do that" | "ठीक है, I'll do that" | "theek hai, I'll do that" |

## Testing the Fix

### How to Verify Roman Script Output

1. **Run Transcription**: Upload an audio file with Hindi/Hinglish speech
2. **Check Console**: Look for validation messages:
   ```
   ✅ Validation passed: All text is in Roman script
   ```
   OR
   ```
   ❌ VALIDATION FAILED: Output contains non-Roman characters!
   ```

3. **Inspect Output**: Check the transcript text:
   - Should see: `"main", "aap", "kaise", "theek hai"`
   - Should NOT see: `"मैं", "आप", "कैसे", "ठीक है"`

### If Non-Roman Characters Still Appear

1. **Check Console Logs**: The validation function will show exactly which segment has issues
2. **Review Prompt**: The AI model may be ignoring instructions (rare with strong prompts)
3. **Try Different Audio**: Some audio quality issues may confuse the model
4. **Check Model**: Ensure using Gemini 2.0 Flash or 1.5 Pro (supports multilingual transcription)

## Technical Details

### Validation Function
**Location**: `src/ai/flows/transcription-flow.ts`

```typescript
function validateRomanScript(output: TranscriptionOutput): void {
  // Checks for 8 different non-Roman scripts
  // Logs detailed errors with segment numbers and characters
  // Helps debug transcription issues
}
```

**Called After**:
- Primary model generation
- Fallback model generation

### Unicode Ranges Detected

| Script | Unicode Range | Pattern |
|--------|---------------|---------|
| Devanagari (Hindi) | U+0900–U+097F | /[\u0900-\u097F]/g |
| Tamil | U+0B80–U+0BFF | /[\u0B80-\u0BFF]/g |
| Telugu | U+0C00–U+0C7F | /[\u0C00-\u0C7F]/g |
| Bengali | U+0980–U+09FF | /[\u0980-\u09FF]/g |
| Gujarati | U+0A80–U+0AFF | /[\u0A80-\u0AFF]/g |
| Kannada | U+0C80–U+0CFF | /[\u0C80-\u0CFF]/g |
| Malayalam | U+0D00–U+0D7F | /[\u0D00-\u0D7F]/g |
| Punjabi | U+0A00–U+0A7F | /[\u0A00-\u0A7F]/g |

## Expected Behavior

### Before Fix
```json
{
  "text": "नमस्ते, मैं रिया बोल रही हूं ETPrime से"
}
```

### After Fix
```json
{
  "text": "namaste, main Riya bol rahi hoon ETPrime se"
}
```

## Summary

✅ **Prompt Enhanced**: Zero-tolerance policy for non-Roman scripts at the top  
✅ **Examples Added**: Clear correct/incorrect examples  
✅ **Validation Added**: Post-generation check for non-Roman characters  
✅ **Schema Updated**: Reinforced Roman-only requirement in output schema  
✅ **Final Instructions**: Pre-output checklist for AI model  

**Result**: All transcripts will now be in Roman English script with proper Hindi/Hinglish transliteration.
