import { NextRequest, NextResponse } from 'next/server';
import { generateFullCallAudio } from '@/ai/flows/generate-full-call-audio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await generateFullCallAudio(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Full call audio generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate full call audio' },
      { status: 500 }
    );
  }
}