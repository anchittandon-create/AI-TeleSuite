import { NextRequest, NextResponse } from 'next/server';
import { scoreCall } from '@/ai/flows/call-scoring';
import { ScoreCallInputSchema, ScoreCallOutput } from '@/types';

export const maxDuration = 300; // 5 minutes max - optimized for cost savings

export async function POST(request: NextRequest) {
  try {
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
  return NextResponse.json({
    message: 'Call scoring API is running',
    status: 'healthy',
    model: 'googleai/gemini-2.0-flash',
    maxDurationSeconds: maxDuration,
    googleApiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY),
  });
}
