
// This file is now deprecated and is no longer used.
// The TTS logic has been moved directly into the speech-synthesis-flow.ts
// to use the Genkit Gemini TTS model, which is a more robust solution.
// This file can be safely deleted.
export async function POST(req: Request) {
  return new Response(JSON.stringify({ error: "This TTS API route is deprecated." }), {
    status: 410, // Gone
    headers: { 'Content-Type': 'application/json' },
  });
}
