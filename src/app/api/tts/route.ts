
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// DO NOT initialize the client here in a serverless environment.
// let ttsClient: TextToSpeechClient;

export async function POST(req: NextRequest) {
  // Initialize the client *inside* the handler.
  // This is the standard and required practice for serverless functions (like Next.js API routes)
  // to ensure credentials are correctly loaded for each invocation.
  let ttsClient: TextToSpeechClient;
  try {
    ttsClient = new TextToSpeechClient();
  } catch (e) {
      console.error("Failed to create TextToSpeechClient. Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly.", e);
      return NextResponse.json({ error: 'TTS Client not initialized. Check server credentials configuration.' }, { status: 500 });
  }


  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text to speak is required.' }, { status: 400 });
    }

    const voiceToUse = voice || 'en-IN-Wavenet-D';

    const request = {
      input: { text: text },
      // Note: The voice name needs to be fully qualified for some models.
      // e.g., 'en-IN-Wavenet-D' is a standard voice.
      voice: { languageCode: 'en-IN', name: voiceToUse },
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    // Synthesize speech and get the audio content.
    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      // Return the audio content as a Base64 encoded string.
      return NextResponse.json({
        audioContent: Buffer.from(response.audioContent).toString('base64'),
      });
    } else {
      return NextResponse.json({ error: 'No audio content received from TTS API.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('ERROR in TTS API route:', error);
    // Provide a more detailed error message to the client for easier debugging.
    return NextResponse.json({ 
        error: 'Failed to synthesize speech.', 
        details: error.message 
    }, { status: 500 });
  }
}
