import { NextRequest, NextResponse } from 'next/server';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput } from '@/types';

export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    const body: ScoreCallInput = await request.json();

    const result = await scoreCall(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Call Scoring API error:', error);
    return NextResponse.json(
      { error: 'Call scoring failed' },
      { status: 500 }
    );
  }
}