import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import type { TranscriptionInput } from '@/types';

export const maxDuration = 800; // 13.3 minutes max for large file transcription (Vercel pro plan limit)

export async function POST(request: NextRequest) {
  try {
    console.log('Transcription API called');
    console.log('GOOGLE_API_KEY present:', !!process.env.GOOGLE_API_KEY);
    console.log('GOOGLE_API_KEY starts with:', process.env.GOOGLE_API_KEY?.substring(0, 10));

    const body: TranscriptionInput = await request.json();
    console.log('Request body received:', { audioUrl: !!body.audioUrl, audioDataUri: !!body.audioDataUri });

    const result = await transcribeAudio(body);
    console.log('Transcription completed successfully');

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