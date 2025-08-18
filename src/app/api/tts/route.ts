
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';

// Use the key.json for authentication as it's more robust for server-side services.
// This avoids issues with API keys not being enabled for specific services.
const credentialsPath = path.resolve(process.cwd(), 'key.json');
let credentials;

try {
    const keyFile = fs.readFileSync(credentialsPath, 'utf8');
    const key = JSON.parse(keyFile);
    credentials = {
        client_email: key.client_email,
        private_key: key.private_key.replace(/\\n/g, '\n'),
    };
} catch (error) {
    console.error("Error reading or parsing key.json:", error);
    // Let the request fail later if credentials are not loaded, 
    // but log the error during initialization.
}

// A GET endpoint for health-checking the TTS service setup
export async function GET() {
  if (credentials && credentials.client_email) {
    return NextResponse.json({ status: 'ok', message: 'TTS service is configured with service account credentials.' });
  } else {
    return NextResponse.json({ status: 'error', message: 'key.json service account file not found or is invalid. TTS service will not work.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    const errorMsg = "TTS API Route Error: Service account credentials from key.json are not properly configured on the server.";
    console.error(errorMsg);
    return new NextResponse(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ttsClient = new TextToSpeechClient({ credentials });

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
        languageCode: voice ? voice.split('-').slice(0, 2).join('-') : 'en-IN',
        name: voice || 'en-IN-Standard-A', 
      },
      audioConfig: { 
        audioEncoding: 'MP3',
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      const audioDataUri = `data:audio/mp3;base64,${Buffer.from(response.audioContent).toString('base64')}`;
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
