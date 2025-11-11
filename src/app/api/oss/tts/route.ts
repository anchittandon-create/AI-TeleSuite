import { NextRequest } from 'next/server';

const DEFAULT_COQUI_ENDPOINT = process.env.COQUI_TTS_ENDPOINT || 'http://localhost:5002/api/tts';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response('Missing text field', { status: 400 });
    }

    const endpoint = DEFAULT_COQUI_ENDPOINT.replace(/\/$/, '');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, speaker_id: process.env.COQUI_TTS_SPEAKER || 'en_US-amy-low' }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Coqui TTS failed (${response.status}): ${err}`);
    }

    const audioArrayBuffer = await response.arrayBuffer();
    if (!audioArrayBuffer.byteLength) {
      throw new Error('Received empty audio response from Coqui');
    }

    return new Response(audioArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioArrayBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(`TTS_ERROR: ${(error as Error).message}`, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    status: 'healthy',
    provider: 'coqui-tts',
    endpoint: DEFAULT_COQUI_ENDPOINT,
  });
}
