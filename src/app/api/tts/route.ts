
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { decode } from 'js-base64';

// This function will run on the Vercel edge runtime if preferred, or standard Node.js runtime.
// export const runtime = 'edge';

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
    return null;
}

const credentials = getServiceAccountCredentials();

// Initialize the client *outside* the request handler to reuse the connection
// This is a best practice for performance.
let ttsClient: TextToSpeechClient | null = null;
if (credentials) {
    ttsClient = new TextToSpeechClient({ credentials });
} else {
    console.error("TTS Client not initialized: Credentials are not configured.");
}


export async function POST(req: NextRequest) {
  if (!ttsClient) {
    const errorMsg = "TTS API Route Error: Google service account credentials are not configured correctly. Ensure the GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable is set and valid.";
    console.error(errorMsg);
    return new NextResponse(errorMsg, { status: 500 });
  }

  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text) {
      return new NextResponse("Missing 'text' in request body", { status: 400 });
    }

    const request = {
      input: { text: text },
      voice: { 
        languageCode: 'en-US', 
        name: voice || 'en-US-Wavenet-F', // Default to a standard voice
      },
      audioConfig: { 
        audioEncoding: 'MP3' as const, // More universally compatible than WAV
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      const audioBase64 = Buffer.from(response.audioContent).toString('base64');
      const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
      
      return NextResponse.json({ audioDataUri: audioDataUri });
    } else {
      throw new Error("No audio content received from TTS API.");
    }

  } catch (error: any) {
    console.error('Error in TTS API route:', error);
    const errorMessage = error.message || "An unknown error occurred during speech synthesis.";
    return new NextResponse(errorMessage, { status: 500 });
  }
}

// Optional: Add a GET handler for health checks or debugging
export async function GET() {
  if (ttsClient) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured.' });
  } else {
    return NextResponse.json({ status: 'error', message: 'TTS service is NOT configured. Check credentials.' }, { status: 500 });
  }
}
