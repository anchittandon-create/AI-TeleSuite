
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Initialize the client without parameters.
// It will automatically use Application Default Credentials (ADC)
// which will find and use the key.json file when run locally.
let ttsClient: TextToSpeechClient | null = null;
let initError: string | null = null;

try {
  ttsClient = new TextToSpeechClient();
  console.log("TTS Client initialized successfully using Application Default Credentials.");
} catch (e: any) {
  initError = `TTS Client failed to initialize: ${e.message}. Ensure key.json is present and valid.`;
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
      voice: { 
        languageCode: 'en-US',
        name: voice || 'en-IN-Standard-A',
      },
      audioConfig: { 
        audioEncoding: 'LINEAR16' as const,
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

export async function GET() {
  if (ttsClient && !initError) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured and client is initialized.' });
  } else {
    return NextResponse.json({ status: 'error', message: initError || 'TTS service is NOT configured.' }, { status: 500 });
  }
}
