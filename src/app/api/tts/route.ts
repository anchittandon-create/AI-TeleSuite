
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { decode } from 'js-base64';

// Helper to get service account credentials from environment variables
function getServiceAccountCredentials() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
        try {
            const decodedString = decode(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64);
            return JSON.parse(decodedString);
        } catch (e) {
            console.error("CRITICAL: Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64. Ensure it's a valid Base64-encoded JSON string.", e);
            return null;
        }
    }
    console.error("CRITICAL: GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable not found.");
    return null;
}

let ttsClient: TextToSpeechClient | null = null;
let credentialsError: string | null = null;

try {
    const credentials = getServiceAccountCredentials();
    if (credentials) {
        ttsClient = new TextToSpeechClient({ credentials });
    } else {
        credentialsError = "TTS Client not initialized: Credentials are not configured correctly in environment variables.";
    }
} catch (e: any) {
    credentialsError = `TTS Client failed to initialize: ${e.message}`;
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
        languageCode: 'en-US', 
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
