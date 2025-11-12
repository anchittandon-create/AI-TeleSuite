import { NextRequest, NextResponse } from 'next/server';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

// Set maxDuration to prevent timeout errors during plan generation
export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    // Accept request and process voice sales agent turn first
    const body = await request.json();
    const result = await runVoiceSalesAgentTurn(body);

    // After successful execution, update quota usage
    const rateLimitCheck = rateLimiter.check({
      identifier: 'voice-sales-agent',
      ...RATE_LIMITS.MODERATE,
    });
    if (!rateLimitCheck.allowed) {
      // Quota exceeded, but allow this request to complete and block future requests
      console.warn('⚠️ Rate limit exceeded for voice sales agent (post-execution)');
      // Optionally, log or notify admin here
    }
    // Always increment usage for this completed request
    rateLimiter.incrementOnly({
      identifier: 'voice-sales-agent',
      ...RATE_LIMITS.MODERATE,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Voice sales agent error:', error);
    return NextResponse.json(
      { error: 'Failed to run voice sales agent' },
      { status: 500 }
    );
  }
}