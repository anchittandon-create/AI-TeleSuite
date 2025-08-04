
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as path from 'path';

// This is the recommended way to use credentials in a server environment
// It will automatically use the GOOGLE_APPLICATION_CREDENTIALS environment variable
// which we set in .env.local to point to key.json
let ttsClient: TextToSpeechClient | null = null;
let initError: string | null = null;

try {
  // Check if credentials are set, this is crucial for Vercel deployment
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // On Vercel, the file might not be "found" by fs.existsSync in the same way,
    // but the environment variable being set is the key. The SDK handles it.
     ttsClient = new TextToSpeechClient();
  } else if (process.env.NODE_ENV === 'development') {
    // In local dev, we can check for the file for better DX.
    const keyPath = path.resolve(process.cwd(), 'key.json');
    if (fs.existsSync(keyPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
      ttsClient = new TextToSpeechClient();
    } else {
       throw new Error("key.json not found at project root and GOOGLE_APPLICATION_CREDENTIALS is not set.");
    }
  } else {
     throw new Error("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
  }
} catch (e: any) {
  initError = `TTS Client failed to initialize: ${e.message}. Ensure your GOOGLE_APPLICATION_CREDENTIALS env var is set correctly and the key.json file is valid.`;
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
        languageCode: 'en-IN',
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
