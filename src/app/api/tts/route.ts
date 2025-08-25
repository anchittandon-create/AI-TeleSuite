
import { NextRequest, NextResponse } from 'next/server';

// This API route will now use the GOOGLE_API_KEY from the environment.
const apiKey = process.env.GOOGLE_API_KEY;

// A GET endpoint for health-checking the TTS service setup
export async function GET() {
  if (apiKey) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured to use the provided GOOGLE_API_KEY.' });
  } else {
    return NextResponse.json({ status: 'error', message: 'GOOGLE_API_KEY not found in environment. TTS service will not work.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!apiKey) {
    const errorMsg = "TTS API Route Error: GOOGLE_API_KEY is not configured on the server.";
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
        name: voice || 'en-IN-Standard-A', 
      },
      audioConfig: { 
        audioEncoding: 'MP3',
      },
    };

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message || `Google TTS API returned an error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
    }
    
    const responseData = await response.json();
    
    if (responseData.audioContent) {
      const audioDataUri = `data:audio/mp3;base64,${responseData.audioContent}`;
      return NextResponse.json({ audioDataUri: audioDataUri });
    } else {
      throw new Error("No audio content received from Google TTS API.");
    }

  } catch (error: any) {
    console.error('Error in TTS API route during synthesis:', error);
    const errorMessage = error.details || error.message || "An unknown error occurred during speech synthesis.";
    return new NextResponse(JSON.stringify({ error: `TTS Synthesis Failed: ${errorMessage}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
