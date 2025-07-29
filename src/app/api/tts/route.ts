
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import {decode} from 'js-base64';

// This function now ONLY uses the environment variable for credentials.
// All fallback logic to read from key.json has been removed for stability.
const getGoogleCredentials = () => {
    try {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
            const decodedString = decode(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64);
            return JSON.parse(decodedString);
        }
        // No fallback. If the environment variable is not set, this will return undefined.
    } catch (e) {
        console.error("CRITICAL: Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64. The variable is present but contains invalid Base64 or JSON data.", e);
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
        
        // This check is now the single point of failure for credentials.
        // It provides a clear, actionable error message if the env var is missing or invalid.
        if (!credentials) {
            const errorMessage = "TTS API Route Error: Google service account credentials are not configured correctly. Ensure the GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable is set and valid.";
            console.error(errorMessage);
            return new NextResponse(errorMessage, { status: 500 });
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
            console.error('TTS API Route Error: Google API did not return audio content.');
            return new NextResponse('Failed to synthesize speech: No audio content received from Google.', { status: 500 });
        }

    } catch (error) {
        console.error('TTS Synthesis Error in API Route:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Provide a more detailed error response to the client.
        return new NextResponse(`Failed to process TTS request. Server-side error: ${errorMessage}`, { status: 500 });
    }
}
