/**
 * @fileOverview Dev/Test endpoint for transcript normalization
 * 
 * POST /api/dev/transcript/normalize
 * 
 * Accepts any transcript format and returns canonical TranscriptDoc.
 * Used for testing normalization with different vendor formats.
 * 
 * Only available in development mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeTranscript } from '@/lib/transcript/normalize';
import type { TranscriptDoc } from '@/types/transcript';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    
    // Extract options from body if provided
    const {
      input,
      defaultAgentName,
      defaultUserName,
      mergeConsecutiveTurns = true,
      source = 'dev-test',
      language,
    } = body;

    // Normalize the input
    const normalized: TranscriptDoc = normalizeTranscript(input || body, {
      defaultAgentName,
      defaultUserName,
      mergeConsecutiveTurns,
      source,
      language,
    });

    return NextResponse.json({
      success: true,
      data: normalized,
      stats: {
        turnCount: normalized.turns.length,
        durationS: normalized.metadata.durationS,
        agentTurns: normalized.turns.filter(t => t.speaker === 'AGENT').length,
        userTurns: normalized.turns.filter(t => t.speaker === 'USER').length,
        systemTurns: normalized.turns.filter(t => t.speaker === 'SYSTEM').length,
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Transcript normalization test error:', err);

    return NextResponse.json(
      {
        success: false,
        error: 'Normalization failed',
        details: {
          message: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'Transcript normalization test endpoint',
    method: 'POST',
    examplePayload: {
      input: {
        segments: [
          {
            speaker: 'AGENT',
            speakerProfile: 'Agent (Riya)',
            text: 'Hello, how can I help you today?',
            startSeconds: 0,
            endSeconds: 3.5,
          },
          {
            speaker: 'USER',
            speakerProfile: 'User (John)',
            text: 'I need help with my order',
            startSeconds: 4.0,
            endSeconds: 6.2,
          },
        ],
      },
      defaultAgentName: 'Riya',
      defaultUserName: 'John',
      mergeConsecutiveTurns: true,
      source: 'test',
      language: 'en',
    },
  });
}
