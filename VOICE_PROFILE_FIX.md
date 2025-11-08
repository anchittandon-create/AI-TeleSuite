# Voice Profile Loading Fix

## Issue
Voice agents were only playing beep sounds instead of using the selected voice profiles for TTS audio generation.

## Root Cause
The TTS API route (`/api/tts/route.ts`) was not properly extracting the language code from voice profile IDs.

### How Voice Profiles Work
Google Cloud TTS requires **both** a `languageCode` and a `name` parameter:
```typescript
voice: { 
  languageCode: "en-IN",  // Language/region code
  name: "en-IN-Wavenet-A" // Full voice profile ID
}
```

### The Problem
Voice profiles in the app are formatted like:
- `en-IN-Wavenet-A` (English India, Female 1)
- `hi-IN-Wavenet-A` (Hindi India, Female 1)
- `en-US-Neural2-C` (English US, Neural voice)

When the frontend sent the voice ID like `"en-IN-Wavenet-A"`, the API was:
1. Using it as the `name` parameter ✅
2. **Not extracting** the language code `"en-IN"` from it ❌
3. Defaulting to `"en-US"` language code ❌

This mismatch caused Google Cloud TTS to fail silently and return an error, which triggered the mock beep fallback.

## Solution
Updated the TTS API route to automatically extract the language code from the voice ID:

```typescript
// Extract language code from voice name if not provided
// Voice names are in format: "en-IN-Wavenet-A" or "en-US-Neural2-C"
let languageCode = body.languageCode;
let voiceName = body.voiceName || process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-C";

if (!languageCode && voiceName) {
  // Extract language code from voice name (e.g., "en-IN-Wavenet-A" -> "en-IN")
  const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
  if (match) {
    languageCode = match[1];
  }
}

// Fallback to environment variable or default
if (!languageCode) {
  languageCode = process.env.GOOGLE_TTS_LANG || "en-US";
}
```

### Regex Explanation
- `^` - Start of string
- `([a-z]{2}-[A-Z]{2})` - Capture group for language code:
  - `[a-z]{2}` - Two lowercase letters (language: en, hi, etc.)
  - `-` - Hyphen separator
  - `[A-Z]{2}` - Two uppercase letters (region: IN, US, etc.)

## Files Changed
- **src/app/api/tts/route.ts** - Added language code extraction logic

## Impact
- ✅ All voice profiles now work correctly
- ✅ English (India) voices: `en-IN-Wavenet-A`, `en-IN-Wavenet-D`, etc.
- ✅ Hindi (India) voices: `hi-IN-Wavenet-A`, `hi-IN-Wavenet-B`, etc.
- ✅ English (US) voices: `en-US-Neural2-C`, `en-US-Wavenet-A`, etc.
- ✅ Proper voice synthesis instead of beep fallback

## Testing
1. Go to Voice Sales Agent or Voice Support Agent
2. Select any voice profile from the dropdown
3. Click "Preview Voice" - should hear the actual voice, not a beep
4. Start a conversation - AI should speak with the selected voice

## Deployment
- **Commit**: `3c0a86ee3`
- **Deployed**: November 9, 2025
- **Production URL**: https://ai-tele-suite-bymq6fwt0-anchittandon-3589s-projects.vercel.app

## Related Files
- `src/hooks/use-voice-samples.ts` - Voice profile definitions
- `src/lib/tts-client.ts` - Client-side TTS synthesis
- `src/app/(main)/voice-sales-agent/page.tsx` - Sales agent implementation
- `src/app/(main)/voice-support-agent/page.tsx` - Support agent implementation

## Future Improvements
1. Add voice profile validation before sending to API
2. Cache successful voice profiles for faster loading
3. Add voice profile preview in configuration section
4. Support custom voice profiles from Google Cloud Console
