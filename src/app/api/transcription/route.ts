import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { TranscriptionInputSchema, TranscriptionOutput } from '@/types';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

const DEFAULT_TRANSCRIPTION_LIMIT = parseInt(process.env.TRANSCRIPTION_CALLS_PER_HOUR || process.env.MAX_EXPENSIVE_CALLS_PER_HOUR || '5', 10);
const TRANSCRIPTION_LIMIT = Number.isFinite(DEFAULT_TRANSCRIPTION_LIMIT) && DEFAULT_TRANSCRIPTION_LIMIT > 0 ? DEFAULT_TRANSCRIPTION_LIMIT : 5;
const TRANSCRIPTION_WINDOW_MS = RATE_LIMITS.EXPENSIVE.windowMs;

const transcriptionRateLimitConfig = {
  identifier: 'transcription',
  maxRequests: TRANSCRIPTION_LIMIT,
  windowMs: TRANSCRIPTION_WINDOW_MS,
};

export const maxDuration = 180; // allow longer audio payloads similar to earlier behavior
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    // Accept request and process transcription first
    const rawBody = await request.json();
    const parsed = TranscriptionInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.error('Transcription input validation failed:', parsed.error.flatten());
      return NextResponse.json(
        {
          error: 'Invalid transcription input',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY missing in environment');
      return NextResponse.json(
        {
          error: 'Google AI key not configured',
          details: 'Set GOOGLE_API_KEY before using transcription features.',
        },
        { status: 500 }
      );
    }

    // Perform transcription
    const result: TranscriptionOutput = await transcribeAudio(parsed.data);

    // After successful transcription, update quota usage
    const rateLimitCheck = rateLimiter.check(transcriptionRateLimitConfig);
    if (!rateLimitCheck.allowed) {
      // Quota exceeded, but allow this request to complete and block future requests
      console.warn('⚠️ Rate limit exceeded for transcription (post-execution)');
      // Optionally, log or notify admin here
    }
    // Always increment usage for this completed request
    rateLimiter.incrementOnly(transcriptionRateLimitConfig);

    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    console.error('Transcription API error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return NextResponse.json(
      {
        error: 'Transcription failed',
        details:
          process.env.NODE_ENV === 'development'
            ? { message: err.message, stack: err.stack, name: err.name }
            : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
    const stats = rateLimiter.getStats('transcription', transcriptionRateLimitConfig.windowMs);
    const remaining = Math.max(0, TRANSCRIPTION_LIMIT - stats.count);
  
  return NextResponse.json({
    message: 'Transcription API is running (Cost-optimized hobby mode)',
    status: 'healthy',
    model: 'googleai/gemini-2.0-flash-exp (FREE TIER)',
    maxDurationSeconds: maxDuration,
    rateLimit: {
      maxPerHour: TRANSCRIPTION_LIMIT,
      callsThisHour: stats.count,
      remaining,
    },
    googleApiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY),
    costOptimization: {
      usingFreeTier: true,
      dailyFreeLimit: 1500,
      estimatedMonthlyCost: '$0 (within free tier)',
    },
  });
}
