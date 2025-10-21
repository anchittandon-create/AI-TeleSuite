import { NextRequest, NextResponse } from 'next/server';
import { generatePitch } from '@/ai/flows/pitch-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await generatePitch(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Pitch generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate pitch' },
      { status: 500 }
    );
  }
}