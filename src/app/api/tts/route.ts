
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as path from 'path';

// --- Robust TTS Client Initialization ---
let ttsClient: TextToSpeechClient | null = null;
let initializationError: string | null = null;

try {
  // This logic correctly handles both local development and Vercel deployment.
  // In dev, it checks for key.json. On Vercel, it relies on the env var being set.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || (process.env.NODE_ENV === 'development' && fs.existsSync(path.resolve(process.cwd(), 'key.json')))) {
    if (process.env.NODE_ENV === 'development' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), 'key.json');
    }
    ttsClient = new TextToSpeechClient();
  } else {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set and key.json was not found at project root.");
  }
} catch (e: any) {
  initializationError = `TTS Client failed to initialize: ${e.message}. Ensure your GOOGLE_APPLICATION_CREDENTIALS env var is set correctly and the key.json file is valid.`;
  console.error("🔴 CRITICAL TTS INITIALIZATION ERROR:", initializationError);
}
// --- End of Initialization ---


export async function POST(req: NextRequest) {
  // If the client failed to initialize, immediately return a clear error.
  if (!ttsClient || initializationError) {
    const errorMsg = initializationError || "TTS API Route Error: TextToSpeechClient is not available or failed to initialize.";
    console.error("TTS POST Error:", errorMsg);
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
        languageCode: voice ? voice.split('-').slice(0, 2).join('-') : 'en-IN',
        name: voice || 'en-IN-Standard-A', // A good default
      },
      // Use WAV format for better compatibility with audio processing if needed
      audioConfig: { 
        audioEncoding: 'LINEAR16' as const, 
        speakingRate: 1.0,
        pitch: 0
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      const audioBase64 = Buffer.from(response.audioContent).toString('base64');
      const audioDataUri = `data:audio/wav;base64,${audioBase64}`;
      
      return NextResponse.json({ audioDataUri: audioDataUri });
    } else {
      throw new Error("No audio content received from Google TTS API.");
    }

  } catch (error: any) {
    console.error('Error in TTS API route during synthesis:', error);
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
  if (ttsClient && !initializationError) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured and client is initialized.' });
  } else {
    return NextResponse.json({ status: 'error', message: initializationError || 'TTS service is NOT configured.' }, { status: 500 });
  }
}
