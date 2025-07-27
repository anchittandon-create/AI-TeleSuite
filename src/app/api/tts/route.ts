
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Initialize the TTS client. 
// It will automatically use the GOOGLE_APPLICATION_CREDENTIALS environment variable 
// set in genkit.ts, which is the most reliable way in Vercel/Next.js environments.
let ttsClient: TextToSpeechClient;
try {
  ttsClient = new TextToSpeechClient();
} catch (e) {
    console.error("Failed to create TextToSpeechClient. Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly.", e);
}


export async function POST(req: NextRequest) {
  if (!ttsClient) {
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
      voice: { languageCode: 'en-IN', name: voiceToUse },
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (response.audioContent) {
      return NextResponse.json({
        audioContent: Buffer.from(response.audioContent).toString('base64'),
      });
    } else {
      return NextResponse.json({ error: 'No audio content received from TTS API.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('ERROR in TTS API route:', error);
    return NextResponse.json({ 
        error: 'Failed to synthesize speech.', 
        details: error.message 
    }, { status: 500 });
  }
}
