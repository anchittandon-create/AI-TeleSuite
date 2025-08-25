
import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { z } from 'zod';

const TtsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional(),
});

// This API route will now use the GOOGLE_API_KEY from the environment.
const apiKey = process.env.GOOGLE_API_KEY;

let client: TextToSpeechClient;

try {
  // Check if GOOGLE_API_KEY is available and is a string
  if (typeof apiKey !== 'string' || !apiKey) {
    throw new Error("GOOGLE_API_KEY is not set or is not a string. Please check your environment variables.");
  }
  
  // The TextToSpeechClient can be initialized with just the api_key
  // when not using service account credentials.
  client = new TextToSpeechClient({ apiKey });

} catch (error) {
  console.error("Critical Error: Failed to initialize TextToSpeechClient.", error);
  // The client is not initialized, so any request to this route will fail.
  // We will handle this gracefully in the POST handler.
}


export async function POST(req: NextRequest) {
  if (!client) {
    return NextResponse.json({ error: "TTS service is not configured due to an initialization error. Check server logs." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const parseResult = TtsRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parseResult.error.format() }, { status: 400 });
    }

    const { text, voice } = parseResult.data;

    // Use a specific, high-quality Hinglish-supporting voice
    const voiceConfig = {
      languageCode: 'en-IN',
      name: voice || 'en-IN-Wavenet-D', // A premium, versatile voice.
      ssmlGender: voice?.toLowerCase().includes('female') ? 'FEMALE' : 'MALE',
    };
    
    // For US voices if specified
    if (voice && voice.startsWith('en-US')) {
        voiceConfig.languageCode = 'en-US';
        voiceConfig.name = voice;
    }

    const request = {
      input: { text: text },
      voice: voiceConfig,
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      return NextResponse.json({ error: "Audio content is missing in the TTS response." }, { status: 500 });
    }

    const audioContent = Buffer.from(response.audioContent as Uint8Array).toString('base64');
    const audioDataUri = `data:audio/mp3;base64,${audioContent}`;

    return NextResponse.json({ audioDataUri });

  } catch (error: any) {
    console.error('TTS Synthesis Failed:', error);
    // Provide a more specific error message if available from the API response
    const errorMessage = error.details || error.message || "An unknown error occurred during TTS synthesis.";
    return NextResponse.json({ error: `TTS Synthesis Failed: ${errorMessage}` }, { status: 500 });
  }
}
