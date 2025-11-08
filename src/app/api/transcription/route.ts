import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { TranscriptionInputSchema, TranscriptionOutput } from '@/types';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

export const maxDuration = 60; // Reduced from 300s for cost savings

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for expensive transcription operations
    const rateLimitCheck = rateLimiter.check({
      identifier: 'transcription',
      ...RATE_LIMITS.EXPENSIVE,
    });
    
    if (!rateLimitCheck.allowed) {
      console.warn('⚠️ Rate limit exceeded for transcription');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: `Maximum ${RATE_LIMITS.EXPENSIVE.maxRequests} transcription calls per hour allowed for this hobby project.`,
          retryAfter: rateLimitCheck.resetAt.toISOString(),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.EXPENSIVE.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitCheck.resetAt.toISOString(),
            'Retry-After': Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    console.log(`✅ Transcription request accepted. Remaining calls this hour: ${rateLimitCheck.remaining}`);
    
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

    const result: TranscriptionOutput = await transcribeAudio(parsed.data);
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
  const stats = rateLimiter.getStats('transcription', RATE_LIMITS.EXPENSIVE.windowMs);
  const remaining = Math.max(0, RATE_LIMITS.EXPENSIVE.maxRequests - stats.count);
  
  return NextResponse.json({
    message: 'Transcription API is running (Cost-optimized hobby mode)',
    status: 'healthy',
    model: 'googleai/gemini-2.0-flash-exp (FREE TIER)',
    maxDurationSeconds: maxDuration,
    rateLimit: {
      maxPerHour: RATE_LIMITS.EXPENSIVE.maxRequests,
      callsThisHour: stats.count,
      remaining: remaining,
    },
    googleApiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY),
    costOptimization: {
      usingFreeTier: true,
      dailyFreeLimit: 1500,
      estimatedMonthlyCost: '$0 (within free tier)',
    },
  });
}
