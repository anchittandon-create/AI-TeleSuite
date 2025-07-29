
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Function to get Google credentials from environment variables
const getGoogleCredentials = () => {
    try {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
            const decodedString = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
            return JSON.parse(decodedString);
        }
    } catch (e) {
        console.error("Failed to parse Google credentials from Base64:", e);
    }
    // Fallback to key file if it exists, for local development convenience.
    try {
        const keyFilename = 'key.json';
        if (require('fs').existsSync(keyFilename)) {
             return JSON.parse(require('fs').readFileSync(keyFilename, 'utf8'));
        }
    } catch (e) {
        console.error("Failed to read credentials from key.json:", e);
    }
    
    return undefined;
};

export async function POST(req: NextRequest) {
    const { text, voice, ssml } = await req.json();

    if (!text) {
        return new NextResponse('Missing text in request body', { status: 400 });
    }

    try {
        const credentials = getGoogleCredentials();
        if (!credentials) {
            console.error("TTS API Route Error: Google service account credentials are not configured.");
            return new NextResponse("TTS service credentials not configured on the server. Please set GOOGLE_SERVICE_ACCOUNT_BASE64 env var.", { status: 500 });
        }

        const client = new TextToSpeechClient({ credentials });

        const request = {
            input: ssml ? { ssml: text } : { text: text },
            voice: {
                languageCode: 'en-US',
                name: voice || 'en-US-Wavenet-F',
                ssmlGender: 'NEUTRAL' as const
            },
            audioConfig: {
                audioEncoding: 'LINEAR16' as const,
                sampleRateHertz: 24000,
            },
        };

        const [response] = await client.synthesizeSpeech(request);
        
        if (response.audioContent) {
            return new NextResponse(response.audioContent, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/wav',
                },
            });
        } else {
            return new NextResponse('Failed to synthesize speech', { status: 500 });
        }

    } catch (error) {
        console.error('TTS Synthesis Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new NextResponse(`Failed to process TTS request. Error: ${errorMessage}`, { status: 500 });
    }
}
