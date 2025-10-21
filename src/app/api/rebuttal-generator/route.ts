import { NextRequest, NextResponse } from 'next/server';
import { generateRebuttal } from '@/ai/flows/rebuttal-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await generateRebuttal(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Rebuttal generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate rebuttal' },
      { status: 500 }
    );
  }
}