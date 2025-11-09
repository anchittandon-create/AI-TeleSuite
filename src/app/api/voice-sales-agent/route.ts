import { NextRequest, NextResponse } from 'next/server';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

// Set maxDuration to prevent timeout errors during plan generation
export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for voice agent interactions
    const rateLimitCheck = rateLimiter.check({
      identifier: 'voice-sales-agent',
      ...RATE_LIMITS.MODERATE,
    });
    
    if (!rateLimitCheck.allowed) {
      console.warn('⚠️ Rate limit exceeded for voice sales agent');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: `Maximum ${RATE_LIMITS.MODERATE.maxRequests} voice agent calls per hour allowed for this hobby project.`,
          retryAfter: rateLimitCheck.resetAt.toISOString(),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.MODERATE.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitCheck.resetAt.toISOString(),
          }
        }
      );
    }

    const body = await request.json();
    const result = await runVoiceSalesAgentTurn(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Voice sales agent error:', error);
    return NextResponse.json(
      { error: 'Failed to run voice sales agent' },
      { status: 500 }
    );
  }
}