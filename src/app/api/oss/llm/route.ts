import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama2';

export async function POST(req: NextRequest) {
  try {
    const { prompt, temperature = 0.7 } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt string' }, { status: 400 });
    }

    const response = await fetch(`${DEFAULT_OLLAMA_ENDPOINT.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature, top_p: 0.95 },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return NextResponse.json({ text: data?.response ?? '' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Open source LLM call failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}
