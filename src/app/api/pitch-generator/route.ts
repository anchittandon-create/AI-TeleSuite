import { NextRequest, NextResponse } from 'next/server';
import { generatePitch } from '@/ai/flows/pitch-generator';
import { GeneratePitchInputSchema } from '@/types';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/types';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = GeneratePitchInputSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pitch input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body: GeneratePitchInput = parsed.data;
    const responsePayload: GeneratePitchOutput = await generatePitch(body);

    const rateLimitCheck = rateLimiter.check({
      identifier: 'pitch-generator',
      ...RATE_LIMITS.MODERATE,
    });
    if (!rateLimitCheck.allowed) {
      console.warn('⚠️ Rate limit exceeded for pitch generator (post-execution).');
    }
    rateLimiter.incrementOnly({
      identifier: 'pitch-generator',
      ...RATE_LIMITS.MODERATE,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const err = error as Error;
    console.error('Pitch Generator API error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return NextResponse.json(
      {
        error: 'Pitch generator failed',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
