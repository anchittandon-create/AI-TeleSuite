
import { NextRequest, NextResponse } from 'next/server';

// Use the same environment variable as Genkit for consistency
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const TTS_API_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;

// A GET endpoint for health-checking the TTS service setup
export async function GET() {
  if (API_KEY) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured with an API key.' });
  } else {
    return NextResponse.json({ status: 'error', message: 'GEMINI_API_KEY or GOOGLE_API_KEY is not set. TTS service will not work.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    const errorMsg = "TTS API Route Error: GEMINI_API_KEY or GOOGLE_API_KEY is not configured on the server.";
    console.error(errorMsg);
    return new NextResponse(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text) {
      return new NextResponse(JSON.stringify({ error: "Missing 'text' in request body" }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestBody = {
      input: { text: text },
      voice: { 
        languageCode: voice ? voice.split('-').slice(0, 2).join('-') : 'en-IN',
        name: voice || 'en-IN-Standard-A', // A standard, widely available voice
      },
      audioConfig: { 
        audioEncoding: 'MP3', // Use MP3 for smaller file size over the wire
      },
    };

    const ttsResponse = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!ttsResponse.ok) {
        const errorData = await ttsResponse.json();
        console.error('Error from Google TTS API:', errorData);
        throw new Error(errorData.error?.message || `Google TTS API responded with status ${ttsResponse.status}`);
    }

    const responseData = await ttsResponse.json();
    
    if (responseData.audioContent) {
      const audioDataUri = `data:audio/mp3;base64,${responseData.audioContent}`;
      return NextResponse.json({ audioDataUri: audioDataUri });
    } else {
      throw new Error("No audio content received from Google TTS API.");
    }

  } catch (error: any) {
    console.error('Error in TTS API route during synthesis:', error);
    const errorMessage = error.message || "An unknown error occurred during speech synthesis.";
    return new NextResponse(JSON.stringify({ error: `TTS Synthesis Failed: ${errorMessage}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
