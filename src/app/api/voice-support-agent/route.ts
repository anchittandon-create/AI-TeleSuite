import { NextRequest, NextResponse } from 'next/server';
import { runVoiceSupportAgentQuery } from '@/ai/flows/voice-support-agent-flow';

// Set maxDuration to prevent timeout errors during query processing
export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await runVoiceSupportAgentQuery(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Voice support agent error:', error);
    return NextResponse.json(
      { error: 'Failed to run voice support agent' },
      { status: 500 }
    );
  }
}