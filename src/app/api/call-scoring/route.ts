import { NextRequest, NextResponse } from 'next/server';
import { scoreCall } from '@/ai/flows/call-scoring';
import { ScoreCallInputSchema, ScoreCallOutput } from '@/types';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

// Reduced timeout for cost savings
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Accept request and process call scoring first
    const rawBody = await request.json();
    const parsed = ScoreCallInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      console.error('Call scoring input validation failed:', parsed.error.flatten());
      return NextResponse.json(
        {
          error: 'Invalid call scoring input',
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
          details: 'Set GOOGLE_API_KEY before using call scoring features.',
        },
        { status: 500 }
      );
    }

    // Perform call scoring
    const result: ScoreCallOutput = await scoreCall(parsed.data);

    // After successful scoring, update quota usage
    const rateLimitCheck = rateLimiter.check({
      identifier: 'call-scoring',
      ...RATE_LIMITS.EXPENSIVE,
    });
    if (!rateLimitCheck.allowed) {
      // Quota exceeded, but allow this request to complete and block future requests
      console.warn('⚠️ Rate limit exceeded for call scoring (post-execution)');
      // Optionally, log or notify admin here
    }
    // Always increment usage for this completed request
    rateLimiter.incrementOnly({
      identifier: 'call-scoring',
      ...RATE_LIMITS.EXPENSIVE,
    });

    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    console.error('Call Scoring API error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return NextResponse.json(
      {
        error: 'Call scoring failed',
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
  const stats = rateLimiter.getStats('call-scoring', RATE_LIMITS.EXPENSIVE.windowMs);
  const remaining = Math.max(0, RATE_LIMITS.EXPENSIVE.maxRequests - stats.count);
  
  return NextResponse.json({
    message: 'Call scoring API is running (Cost-optimized hobby mode)',
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
