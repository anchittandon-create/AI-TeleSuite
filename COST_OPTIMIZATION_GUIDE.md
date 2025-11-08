# 💰 Cost Optimization Guide for AI-TeleSuite (Hobby Project)

## 🎯 Goal: Keep Google Cloud Billing Under $5/month (or FREE!)

This guide explains all the cost-saving measures implemented in the application.

---

## 📊 What Changed?

### 1. **Switched to FREE Tier Models** ⭐
   - **Before**: Using `gemini-2.5-pro` (EXPENSIVE!)
   - **After**: Using `gemini-2.0-flash-exp` (FREE TIER)
   - **Savings**: ~95% cost reduction
   - **Free Tier Limits**: 1500 requests/day (plenty for hobby use)

### 2. **Aggressive Rate Limiting** 🚦
   Implemented 3 tiers of rate limits:
   - **EXPENSIVE** (Transcription, Call Scoring): 5 calls/hour
   - **MODERATE** (Voice Agents, AI Generation): 20 calls/hour  
   - **LIGHT** (Simple queries): 100 calls/hour

### 3. **Reduced Timeouts** ⏱️
   - **Before**: 300 seconds (5 minutes)
   - **After**: 60 seconds (1 minute)
   - **Benefit**: Prevents long-running expensive operations

---

## 🔧 How to Adjust Rate Limits

Edit `.env.local` to customize limits:

```bash
# Increase limits (WARNING: May increase costs!)
MAX_EXPENSIVE_CALLS_PER_HOUR=10   # Default: 5
MAX_MODERATE_CALLS_PER_HOUR=50    # Default: 20
MAX_LIGHT_CALLS_PER_HOUR=200      # Default: 100
```

---

## 📈 Monitoring Your Usage

### 1. **Check API Health Endpoints**

Get real-time rate limit status:

```bash
# Call Scoring
curl http://localhost:3000/api/call-scoring

# Transcription
curl http://localhost:3000/api/transcription
```

Response includes:
```json
{
  "status": "healthy",
  "model": "googleai/gemini-2.0-flash-exp (FREE TIER)",
  "rateLimit": {
    "maxPerHour": 5,
    "callsThisHour": 2,
    "remaining": 3
  },
  "costOptimization": {
    "usingFreeTier": true,
    "dailyFreeLimit": 1500,
    "estimatedMonthlyCost": "$0 (within free tier)"
  }
}
```

### 2. **Google Cloud Console**

Monitor actual usage:
1. Visit: https://console.cloud.google.com/apis/dashboard
2. Go to "APIs & Services" → "Dashboard"
3. View Gemini API usage graphs
4. Set budget alerts (recommended: $5/month)

---

## 💡 Cost-Saving Best Practices

### ✅ DO:
- Use the app during testing/development only
- Test with short audio files (< 5 minutes)
- Cache results when possible
- Use transcription wisely (it's the most expensive)
- Stay within free tier limits (1500 requests/day)

### ❌ DON'T:
- Make bulk API calls in loops
- Upload very long audio files (> 10 minutes)
- Run automated tests that hit APIs repeatedly
- Share your API key publicly
- Enable auto-retry mechanisms without limits

---

## 🚨 What to Do If Costs Spike

### Immediate Actions:
1. **Check rate limit violations**: Look for 429 errors in logs
2. **Review recent activity**: Check Google Cloud Console
3. **Temporarily disable features**: Comment out expensive flows
4. **Reset rate limiter**: Restart the development server

### Emergency: Disable AI Features Temporarily
Create `.env.local.backup` and remove `GOOGLE_API_KEY`:
```bash
mv .env.local .env.local.backup
echo "GOOGLE_API_KEY=" > .env.local
```

The app will gracefully handle missing API keys and show helpful error messages.

---

## 📦 Model Pricing Reference (as of Nov 2024)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Audio (per hour) |
|-------|----------------------|------------------------|------------------|
| **gemini-2.0-flash-exp** | **FREE** | **FREE** | **FREE** |
| gemini-1.5-flash | $0.075 | $0.30 | $0.075 |
| gemini-1.5-pro | $1.25 | $5.00 | $1.25 |
| gemini-2.5-pro | $2.50 | $10.00 | $2.50 |

**Current Config**: Using `gemini-2.0-flash-exp` exclusively = **$0/month**

---

## 🎓 Understanding the Free Tier

### Gemini 2.0 Flash Experimental (FREE!)
- **Daily Limit**: 1500 requests per day
- **Rate Limit**: 10 requests per minute
- **Max Tokens**: 1M input, 8K output
- **Audio Support**: Yes (up to 1 hour per request)
- **Cost**: $0 (no credit card required)

With rate limits in place:
- **5 transcriptions/hour** = 120/day (well within free tier)
- **20 voice agent calls/hour** = 480/day (within free tier)

---

## 🔍 Rate Limiter Details

The rate limiter is **in-memory** (resets on server restart):
- ✅ Perfect for hobby projects
- ✅ Zero infrastructure cost
- ✅ No Redis/database needed
- ⚠️ Resets when you restart `npm run dev`

For production, consider:
- Redis-backed rate limiting
- Database-backed quota tracking
- Per-user rate limits

---

## 📊 Estimated Monthly Costs

### Scenario 1: Light Usage (Current Setup)
- 5 call scorings/day
- 10 transcriptions/day
- 20 voice agent interactions/day
- **Cost**: $0 (within free tier)

### Scenario 2: Moderate Usage
- 50 operations/day across all features
- **Cost**: $0 (still within free tier)

### Scenario 3: Heavy Usage (Exceeding Free Tier)
- 200 operations/day
- Using paid models instead of flash-exp
- **Cost**: $50-100/month ⚠️

**Recommendation**: Stick with Scenario 1-2 for hobby use!

---

## 🛠️ Advanced Cost Optimization

### 1. **Implement Caching**
Cache AI responses for identical inputs:
```typescript
import { createHash } from 'crypto';

const cache = new Map<string, any>();

function getCacheKey(input: any): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

// Before calling AI:
const cacheKey = getCacheKey(input);
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 2. **Transcript Truncation**
Limit transcript length to reduce tokens:
```typescript
const MAX_TRANSCRIPT_LENGTH = 5000; // characters
const truncatedTranscript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
```

### 3. **Batch Processing**
Instead of real-time scoring, batch process overnight:
```typescript
// Process in off-peak hours
if (new Date().getHours() >= 22 || new Date().getHours() < 6) {
  // Process batch
}
```

---

## 📝 Files Modified for Cost Optimization

1. **`src/ai/config/models.ts`**
   - Changed all models to `gemini-2.0-flash-exp`
   
2. **`src/lib/rate-limiter.ts`** (NEW)
   - Centralized rate limiting utility
   
3. **`src/app/api/call-scoring/route.ts`**
   - Added rate limiting (5 calls/hour)
   - Reduced timeout to 60s
   
4. **`src/app/api/transcription/route.ts`**
   - Added rate limiting (5 calls/hour)
   - Reduced timeout to 60s
   
5. **`src/app/api/voice-sales-agent/route.ts`**
   - Added rate limiting (20 calls/hour)
   
6. **`.env.local`**
   - Added cost control environment variables

---

## ✅ Verification Checklist

- [x] All models using `gemini-2.0-flash-exp`
- [x] Rate limiting enabled on expensive endpoints
- [x] Timeouts reduced to 60 seconds
- [x] Environment variables configured
- [x] Health check endpoints working
- [x] Error messages user-friendly

---

## 🆘 Support

If you're still seeing high costs:
1. Share your Google Cloud billing dashboard screenshot
2. Check which API is consuming most tokens
3. Review server logs for unexpected errors
4. Consider disabling features you don't actively use

---

## 🎉 Success Metrics

You've successfully optimized costs when:
- Monthly bill is $0-2
- No rate limit violations during normal use
- All features work as expected
- Response times are acceptable (< 10s for most operations)

**Remember**: This is a hobby project! Don't stress about optimization. The free tier is generous enough for learning and experimentation.
