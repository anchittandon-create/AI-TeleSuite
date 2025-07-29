
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as path from 'path';

let ttsClient: TextToSpeechClient | null = null;
let credentialsError: string | null = null;

try {
    // Determine the path to key.json. In Vercel/Next.js, process.cwd() points to the root.
    const keyFilePath = path.join(process.cwd(), 'key.json');
    
    // This is the correct way to initialize the client with service account credentials from a file.
    ttsClient = new TextToSpeechClient({ keyFilename: keyFilePath });
    console.log("TTS Client initialized successfully using key.json.");

} catch (e: any) {
    credentialsError = `TTS Client failed to initialize from key.json: ${e.message}. Ensure key.json is present and valid.`;
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
        audioEncoding: 'MP3' as const,
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
    const errorMessage = error.message || "An unknown error occurred during speech synthesis.";
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
