import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { TranscriptionInputSchema, TranscriptionOutput } from '@/types';

export const maxDuration = 300; // 5 minutes max on Vercel hobby

export async function POST(request: NextRequest) {
  try {
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
  return NextResponse.json({
    message: 'Transcription API is running',
    status: 'healthy',
    model: 'googleai/gemini-2.0-flash',
    maxDurationSeconds: maxDuration,
    googleApiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY),
  });
}
