
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as path from 'path';

let ttsClient: TextToSpeechClient | null = null;
let credentialsError: string | null = null;

try {
    // The client will now automatically find the credentials via the
    // GOOGLE_APPLICATION_CREDENTIALS environment variable.
    // No need to specify keyFilename.
    ttsClient = new TextToSpeechClient();
    console.log("TTS Client initialized. It will use GOOGLE_APPLICATION_CREDENTIALS.");

} catch (e: any) {
    credentialsError = `TTS Client failed to initialize: ${e.message}. Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly.`;
    console.error(credentialsError, e);
}


export async function POST(req: NextRequest) {
  if (!ttsClient || credentialsError) {
    const errorMsg = credentialsError || "TTS API Route Error: TextToSpeechClient is not available.";
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
      voice: { 
        languageCode: 'en-US', // Language code can be part of the voice name or set explicitly
        name: voice || 'en-IN-Standard-A', // Default to a standard voice
      },
      audioConfig: { 
        audioEncoding: 'LINEAR16' as const, // Use WAV format (PCM) for broader compatibility
        speakingRate: 1.0
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
    const errorMessage = error.details || error.message || "An unknown error occurred during speech synthesis.";
    return new NextResponse(JSON.stringify({ error: `TTS Synthesis Failed: ${errorMessage}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Optional: Add a GET handler for health checks or debugging
export async function GET() {
  if (ttsClient && !credentialsError) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured and client is initialized.' });
  } else {
    return NextResponse.json({ status: 'error', message: credentialsError || 'TTS service is NOT configured.' }, { status: 500 });
  }
}
