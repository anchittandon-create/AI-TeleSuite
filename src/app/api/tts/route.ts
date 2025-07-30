
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Initialize the client.
// When running in an environment with GOOGLE_APPLICATION_CREDENTIALS set
// (pointing to key.json), the library will automatically use them.
// This is the standard and most robust way.
let ttsClient: TextToSpeechClient | null = null;
let initError: string | null = null;

try {
  ttsClient = new TextToSpeechClient();
} catch (e: any) {
  initError = `TTS Client failed to initialize: ${e.message}. Please ensure your service account credentials (key.json) are correctly configured.`;
  console.error(initError, e);
}

export async function POST(req: NextRequest) {
  if (!ttsClient) {
    const errorMsg = initError || "TTS API Route Error: TextToSpeechClient is not available.";
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

    const request = {
      input: { text: text },
      // Use standard voices for the generous free tier
      voice: { 
        languageCode: 'en-US', // Can be parameterized in the future
        name: voice || 'en-IN-Standard-A', // A good default
      },
      audioConfig: { 
        audioEncoding: 'MP3' as const, // MP3 is efficient for web streaming
        speakingRate: 1.0
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      const audioBase64 = Buffer.from(response.audioContent).toString('base64');
      const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
      
      return NextResponse.json({ audioDataUri: audioDataUri });
    } else {
      throw new Error("No audio content received from Google TTS API.");
    }

  } catch (error: any) {
    console.error('Error in TTS API route:', error);
    // Provide a more user-friendly error message
    const errorMessage = error.details || error.message || "An unknown error occurred during speech synthesis.";
    return new NextResponse(JSON.stringify({ error: `TTS Synthesis Failed: ${errorMessage}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}

// A GET endpoint for health-checking the TTS service setup
export async function GET() {
  if (ttsClient && !initError) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured and client is initialized.' });
  } else {
    return NextResponse.json({ status: 'error', message: initError || 'TTS service is NOT configured.' }, { status: 500 });
  }
}
