import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import type { TranscriptionInput } from '@/types';

export const maxDuration = 900; // 15 minutes for Vercel Pro plan

export async function POST(request: NextRequest) {
  try {
    const body: TranscriptionInput = await request.json();

    const result = await transcribeAudio(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}