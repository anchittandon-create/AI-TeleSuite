import { NextRequest, NextResponse } from 'next/server';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput } from '@/types';

export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    console.log('Call Scoring API called');
    console.log('GOOGLE_API_KEY present:', !!process.env.GOOGLE_API_KEY);
    console.log('GOOGLE_API_KEY starts with:', process.env.GOOGLE_API_KEY?.substring(0, 10));

    const body: ScoreCallInput = await request.json();
    console.log('Request body received:', {
      product: body.product,
      hasAudioUrl: !!body.audioUrl,
      hasAudioDataUri: !!body.audioDataUri,
      hasTranscript: !!body.transcriptOverride
    });

    const result = await scoreCall(body);
    console.log('Call scoring completed successfully');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Call Scoring API error:', error);
    const err = error as Error;
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    return NextResponse.json(
      {
        error: 'Call scoring failed',
        details: process.env.NODE_ENV === 'development' ? {
          message: err.message,
          type: err.name
        } : undefined
      },
      { status: 500 }
    );
  }
}