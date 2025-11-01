import { NextRequest, NextResponse } from 'next/server';

/**
 * This API route intentionally returns 410 (Gone).
 * Text-to-Speech is now handled on the client via /src/lib/tts-client.ts.
 * Keeping this route avoids legacy callers crashing while signalling deprecation.
 */

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'The /api/tts endpoint has been deprecated. Use the client-side tts-client utility instead.',
    },
    { status: 410 }
  );
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      message: 'The /api/tts endpoint has been deprecated. Use the client-side tts-client utility instead.',
    },
    { status: 410 }
  );
}
