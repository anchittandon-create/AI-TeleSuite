import { NextRequest, NextResponse } from 'next/server';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput } from '@/types';

export const maxDuration = 300; // 5 minutes max - optimized for cost savings

export async function POST(request: NextRequest) {
  try {
    const body: ScoreCallInput = await request.json();
    const result = await scoreCall(body);
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
        details: {
          message: err.message,
          type: err.name
        }
      },
      { status: 500 }
    );
  }
}