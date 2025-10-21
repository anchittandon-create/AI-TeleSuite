import { NextRequest, NextResponse } from 'next/server';
import { generateTrainingDeck } from '@/ai/flows/training-deck-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await generateTrainingDeck(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Training deck generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate training deck' },
      { status: 500 }
    );
  }
}