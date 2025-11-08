# Server-Side TTS Implementation Guide

## Overview

The Voice Agent TTS has been migrated from client-side API key authentication to **server-side Service Account authentication**. This fixes the "Requests to this API are blocked" error and provides better security and reliability.

## Architecture

```
Browser → /api/tts (Server Route) → Google Cloud TTS API
                ↓
        Audio Bytes (MP3/WAV)
                ↓
        Client plays via Object URL
```

**Key Changes:**
- ✅ All TTS requests go through `/api/tts` server route
- ✅ Service Account authentication (not API keys)
- ✅ Returns raw audio bytes (not JSON)
- ✅ Mock beep fallback for development
- ✅ Proper error handling and health checks

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install @google-cloud/text-to-speech
```

### 2. Create Service Account (Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **IAM & Admin → Service Accounts**
4. Click **Create Service Account**
5. Name: `tts-service-account`
6. Grant role: **Cloud Text-to-Speech User**
7. Click **Done**
8. Click on the created service account
9. Go to **Keys** tab
10. Click **Add Key → Create New Key**
11. Choose **JSON** format
12. Download the JSON file

### 3. Configure Environment Variables

Add to `.env.local`:

```bash
# Required: Full JSON of service account key (stringified on one line)
GOOGLE_TTS_SA_JSON='{"type":"service_account","project_id":"your-project",...}'

# Optional: TTS Configuration
GOOGLE_TTS_LANG=en-US
GOOGLE_TTS_VOICE=en-US-Neural2-C
GOOGLE_TTS_ENCODING=MP3

# Optional: Force mock mode for testing
MOCK_TTS=false
NEXT_PUBLIC_MOCK_TTS=false
```

**Important:** The `GOOGLE_TTS_SA_JSON` must be the **entire contents** of the downloaded JSON file, stringified on a single line.

#### Example: Convert JSON to Single Line

**Original service-account.json:**
```json
{
  "type": "service_account",
  "project_id": "my-project-123",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "tts-service@my-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

**Convert to single line:**
```bash
# Method 1: Using jq (recommended)
cat service-account.json | jq -c . > service-account-oneline.txt

# Method 2: Manual copy-paste
# Copy the entire JSON and paste into .env.local as GOOGLE_TTS_SA_JSON='...'
```

**Add to .env.local:**
```bash
GOOGLE_TTS_SA_JSON='{"type":"service_account","project_id":"my-project-123","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"tts-service@my-project.iam.gserviceaccount.com",...}'
```

### 4. Verify Setup

**Health Check:**
```bash
curl http://localhost:3000/api/tts
```

**Expected Response:**
```json
{
  "status": "healthy",
  "mode": "gcloud",
  "languageCode": "en-US",
  "voiceName": "en-US-Neural2-C",
  "audioEncoding": "MP3"
}
```

**Test Synthesis:**
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world"}' \
  --output test.mp3
```

---

## API Reference

### Server Route: `/api/tts`

#### POST `/api/tts`

**Request Body:**
```typescript
{
  text: string;              // Required: Text to synthesize
  languageCode?: string;     // Optional: e.g., "en-US" (default from env)
  voiceName?: string;        // Optional: e.g., "en-US-Neural2-C" (default from env)
  speakingRate?: number;     // Optional: 0.25–4.0 (default: 1.0)
  pitch?: number;            // Optional: -20.0–20.0 (default: 0)
  audioEncoding?: "MP3" | "LINEAR16"; // Optional: default "MP3"
}
```

**Response:**
- **200 OK**: Returns raw audio bytes
  - Headers:
    - `Content-Type: audio/mpeg` (for MP3) or `audio/wav` (for LINEAR16)
    - `Content-Length: <bytes>`
    - `X-TTS-Provider: gcloud`
- **400 Bad Request**: Missing `text` field
- **500 Internal Server Error**: TTS synthesis failed
  - Body: `TTS_ERROR: <error message>`

#### GET `/api/tts`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy" | "error",
  "mode": "gcloud" | "mock",
  "message"?: string,
  "languageCode"?: string,
  "voiceName"?: string,
  "audioEncoding"?: string
}
```

---

## Client Usage

### Basic Synthesis

```typescript
import { synthesizeSpeechOnClient } from "@/lib/tts-client";

async function speakText() {
  try {
    const { audioDataUri } = await synthesizeSpeechOnClient({
      text: "Hello, how can I help you today?",
      voice: "en-US-Neural2-C",
    });

    // Play audio
    const audio = new Audio(audioDataUri);
    await audio.play();
  } catch (error) {
    console.error("TTS failed:", error);
    // Mock beep fallback is automatic
  }
}
```

### Advanced Usage with Options

```typescript
const { audioDataUri } = await synthesizeSpeechOnClient({
  text: "This is slower and higher pitched.",
  voice: "en-US-Neural2-D",
  speakingRate: 0.8,  // Slower speech
  pitch: 5.0,         // Higher pitch
  audioEncoding: "MP3",
});
```

### With Playback Controls

```typescript
import { synthesizeSpeechOnClient, playAudioDataUri } from "@/lib/tts-client";

async function speakWithControls() {
  const { audioDataUri } = await synthesizeSpeechOnClient({
    text: "Hello world",
  });

  const audio = await playAudioDataUri(
    audioDataUri,
    () => console.log("Audio finished"),
    (error) => console.error("Playback error:", error)
  );

  // Can control playback
  // audio.pause();
  // audio.currentTime = 0;
}
```

### Cancel Ongoing Synthesis

```typescript
import { cancelCurrentSynthesis } from "@/lib/tts-client";

// Cancel current TTS request (e.g., user interrupted)
cancelCurrentSynthesis();
```

---

## Mock Fallback Mode

For development or when TTS quota is exceeded, the system automatically generates a beep sound as fallback.

### Enable Mock Mode

**Option 1: Environment Variable**
```bash
MOCK_TTS=true              # Server-side
NEXT_PUBLIC_MOCK_TTS=true  # Client-side
```

**Option 2: Automatic Fallback**
Mock beep is automatically used when:
- Service account JSON is missing
- TTS API request fails
- Network error occurs

### Mock Beep Characteristics
- **Frequency**: 440Hz (A note)
- **Duration**: 0.3 seconds
- **Format**: WAV (generated in-browser)
- **Volume**: 30% amplitude

---

## Error Handling

### Common Errors and Solutions

#### Error: "Missing GOOGLE_TTS_SA_JSON"

**Cause:** Service account JSON not configured.

**Solution:**
1. Add service account JSON to `.env.local`
2. Ensure it's on a single line
3. Restart dev server

#### Error: "TTS_ERROR: ... quota exceeded"

**Cause:** Google Cloud TTS quota limit reached.

**Solution:**
1. Enable mock mode: `MOCK_TTS=true`
2. Increase quota in Google Cloud Console
3. Wait for quota reset (usually monthly)

#### Error: "TTS_ERROR: ... permission denied"

**Cause:** Service account lacks TTS permissions.

**Solution:**
1. Go to IAM & Admin in Google Cloud Console
2. Find your service account
3. Add role: **Cloud Text-to-Speech User**

#### Error: "Empty audio"

**Cause:** TTS returned no audio data.

**Solution:**
1. Check text input (must not be empty)
2. Verify voice name is valid
3. Check Google Cloud Console for API errors

---

## Migration from Old Client-Side TTS

### Old Code (Client-Side API Key)

```typescript
// ❌ Old: Direct API call with API key
const response = await fetch(
  `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
  {
    method: "POST",
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voice },
      audioConfig: { audioEncoding: "MP3" },
    }),
  }
);
```

### New Code (Server-Side Service Account)

```typescript
// ✅ New: Server-side route with Service Account
const { audioDataUri } = await synthesizeSpeechOnClient({
  text: "Hello world",
  voice: "en-US-Neural2-C",
});
```

**Benefits:**
- ✅ No CORS issues
- ✅ No API key exposure in browser
- ✅ Better error handling
- ✅ Automatic mock fallback
- ✅ Request deduplication

---

## Voice Agent Integration

### Update Voice Agent TTS Calls

**Before:**
```typescript
const result = await synthesizeSpeechOnClient({
  text: agentResponse,
  voice: selectedVoiceId, // e.g., "en-IN-Wavenet-D"
});
```

**After (No Changes Needed):**
```typescript
// Same API, now routes through server
const result = await synthesizeSpeechOnClient({
  text: agentResponse,
  voice: selectedVoiceId,
});
```

The client API remains the same, but now routes through `/api/tts` automatically.

---

## Deployment (Vercel)

### Environment Variables

Add these to your Vercel project settings:

1. Go to **Project Settings → Environment Variables**
2. Add the following:

```bash
GOOGLE_TTS_SA_JSON=<paste-entire-json-here>
GOOGLE_TTS_LANG=en-US
GOOGLE_TTS_VOICE=en-US-Neural2-C
GOOGLE_TTS_ENCODING=MP3
```

**Important:** For `GOOGLE_TTS_SA_JSON`:
1. Copy the entire contents of your service account JSON file
2. Paste it as the value (Vercel will handle escaping)
3. Do NOT wrap in additional quotes

### Verify Deployment

After deployment:

```bash
curl https://your-app.vercel.app/api/tts
```

Expected response:
```json
{
  "status": "healthy",
  "mode": "gcloud"
}
```

---

## Monitoring and Logs

### Server Logs

TTS errors are logged with detailed messages:

```typescript
// Server-side error format
TTS_ERROR: 7 PERMISSION_DENIED: Permission denied...
```

### Client Logs

```typescript
// Automatic fallback logs
console.log("TTS failed, using mock beep:", errorMessage);
```

### Health Check

Monitor TTS health:

```bash
# Check every 5 minutes
*/5 * * * * curl https://your-app.vercel.app/api/tts >> /var/log/tts-health.log
```

---

## Testing

### Unit Tests

```typescript
import { synthesizeSpeechOnClient } from "@/lib/tts-client";

describe("TTS Client", () => {
  it("should synthesize speech", async () => {
    const result = await synthesizeSpeechOnClient({
      text: "Test",
    });
    
    expect(result.audioDataUri).toMatch(/^data:audio\//);
  });

  it("should fallback to mock on error", async () => {
    // Set mock mode
    process.env.NEXT_PUBLIC_MOCK_TTS = "true";
    
    const result = await synthesizeSpeechOnClient({
      text: "Test",
    });
    
    expect(result.audioDataUri).toMatch(/^data:audio\/wav/);
  });
});
```

### Integration Tests

```bash
# Test server endpoint
npm run test:api

# Test with real service account
GOOGLE_TTS_SA_JSON='...' npm run test:tts
```

---

## Troubleshooting

### Issue: TTS works locally but not on Vercel

**Solution:**
1. Verify `GOOGLE_TTS_SA_JSON` is set in Vercel environment variables
2. Check that private key includes `\n` characters (Vercel should preserve them)
3. Redeploy after updating environment variables

### Issue: Audio playback blocked by browser

**Solution:**
1. Require user interaction before first playback
2. Use the `playAudioDataUri` helper which handles autoplay errors
3. Show a "Tap to enable audio" button if needed

### Issue: Slow TTS response

**Solution:**
1. Check network latency to Google Cloud
2. Consider caching common phrases
3. Use shorter text chunks for streaming conversations

---

## Available Voices

Popular voices for English:

- `en-US-Neural2-A` (Male, casual)
- `en-US-Neural2-C` (Female, clear) ⭐ **Default**
- `en-US-Neural2-D` (Male, professional)
- `en-US-Neural2-F` (Female, warm)
- `en-US-Wavenet-A` (Male, natural)
- `en-US-Wavenet-C` (Female, conversational)

**Full list:** [Google Cloud TTS Voices](https://cloud.google.com/text-to-speech/docs/voices)

---

## Cost Estimation

**Google Cloud TTS Pricing** (as of 2024):

- **Standard voices**: $4 per 1 million characters
- **WaveNet voices**: $16 per 1 million characters
- **Neural2 voices**: $16 per 1 million characters

**Example:**
- Average agent response: 100 characters
- 1000 voice calls = 100,000 characters
- Cost with Neural2: ~$1.60

**Free Tier:**
- 0–1 million characters/month: WaveNet voices free
- 0–4 million characters/month: Standard voices free

---

## Security Best Practices

1. **Never commit service account JSON to git**
   - Add to `.gitignore`: `*service-account*.json`
   
2. **Use separate service accounts per environment**
   - Development: `tts-dev@project.iam`
   - Production: `tts-prod@project.iam`

3. **Rotate service account keys regularly**
   - Every 90 days recommended

4. **Limit service account permissions**
   - Only grant "Cloud Text-to-Speech User" role
   - No additional permissions needed

5. **Monitor usage and quotas**
   - Set up budget alerts in Google Cloud Console
   - Monitor for unusual usage patterns

---

## Related Files

- Server Route: `src/app/api/tts/route.ts`
- Client Helper: `src/lib/tts-client.ts`
- Voice Sales Agent: `src/app/(main)/voice-sales-agent/page.tsx`
- Voice Support Agent: `src/app/(main)/voice-support-agent/page.tsx`

---

## Support

For issues or questions:
1. Check server logs: `vercel logs`
2. Test health endpoint: `curl /api/tts`
3. Enable mock mode to isolate issue
4. Review Google Cloud Console for API errors

**Common Support Resources:**
- [Google Cloud TTS Documentation](https://cloud.google.com/text-to-speech/docs)
- [Service Account Setup Guide](https://cloud.google.com/iam/docs/service-accounts)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
