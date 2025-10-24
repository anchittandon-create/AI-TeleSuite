import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import type { TranscriptionInput } from '@/types';

export const maxDuration = 300; // 5 minutes max - optimized for cost savings

export async function POST(request: NextRequest) {
  try {
    const body: TranscriptionInput = await request.json();
    const result = await transcribeAudio(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Transcription API error:', error);
    const err = error as Error;
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    return NextResponse.json(
      {
        error: 'Transcription failed',
        details: process.env.NODE_ENV === 'development' ? {
          message: err.message,
          type: err.name
        } : undefined
      },
      { status: 500 }
    );
  }
}