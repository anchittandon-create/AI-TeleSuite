import { NextRequest, NextResponse } from 'next/server';
import { scoreCall } from '@/ai/flows/call-scoring';
import { ScoreCallInputSchema, ScoreCallOutput } from '@/types';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

// Reduced timeout for cost savings
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first to prevent cost overruns
    const rateLimitCheck = rateLimiter.check({
      identifier: 'call-scoring',
      ...RATE_LIMITS.EXPENSIVE,
    });
    
    if (!rateLimitCheck.allowed) {
      console.warn('⚠️ Rate limit exceeded for call scoring');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: `Maximum ${RATE_LIMITS.EXPENSIVE.maxRequests} calls per hour allowed for this hobby project. Please try again later.`,
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

    console.log(`✅ Call scoring request accepted. Remaining calls this hour: ${rateLimitCheck.remaining}`);
    
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

    const result: ScoreCallOutput = await scoreCall(parsed.data);
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
