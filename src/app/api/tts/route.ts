
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import key from '../../../../key.json'; // Import the key directly

// --- Robust TTS Client Initialization ---
let ttsClient: TextToSpeechClient | null = null;
let initializationError: string | null = null;

try {
  if (!key.client_email || !key.private_key) {
    throw new Error("key.json is missing 'client_email' or 'private_key'.");
  }

  console.log("TTS API Route: Initializing TextToSpeechClient...");
  ttsClient = new TextToSpeechClient({
    credentials: {
      client_email: key.client_email,
      // CRITICAL FIX: The private key from the JSON file has literal "\\n" characters.
      // These must be replaced with actual newline characters ("\n") for the crypto library to parse the key correctly.
      private_key: key.private_key.replace(/\\n/g, '\n'),
    },
    projectId: key.project_id,
  });
  console.log("TTS API Route: TextToSpeechClient initialized successfully.");

} catch (e: any) {
  initializationError = `TTS Client failed to initialize: ${e.message}. Ensure your key.json file is valid and complete.`;
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
