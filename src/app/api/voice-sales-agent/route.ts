import { NextRequest, NextResponse } from 'next/server';
import { runVoiceSalesAgentTurn } from '@/ai/flows/voice-sales-agent-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await runVoiceSalesAgentTurn(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Voice sales agent error:', error);
    return NextResponse.json(
      { error: 'Failed to run voice sales agent' },
      { status: 500 }
    );
  }
}