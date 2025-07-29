
'use server';
/**
 * @fileOverview Speech synthesis flow for OpenTTS.
 * This flow is designed to be called from the client-side. It fetches audio
 * from a locally running OpenTTS server and returns it as a data URI.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput } from '@/types';
import { encode } from 'js-base64';

// This flow now encapsulates the CLIENT-SIDE logic for calling a local OpenTTS server.
// The actual fetch happens on the client, but the logic is defined here.

export async function synthesizeSpeechWithOpenTTS(input: z.infer<typeof SynthesizeSpeechInputSchema>): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    const openTtsUrl = 'http://localhost:5500/api/tts';
    const voiceToUse = voiceProfileId || 'en-us_ljspeech';

    // This is the actual client-side implementation
    try {
        const response = await fetch(openTtsUrl, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json'
             },
             body: JSON.stringify({
                 voice: voiceToUse,
                 text: textToSpeak,
                 ssml: false
             })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenTTS server returned an error: ${response.status} ${response.statusText}. Details: ${errorText}`);
        }
        
        // Correctly handle the audio data in a browser-compatible way
        const audioArrayBuffer = await response.arrayBuffer();

        // Convert ArrayBuffer to Base64 string using js-base64
        const uint8Array = new Uint8Array(audioArrayBuffer);
        const base64String = encode(String.fromCharCode.apply(null, Array.from(uint8Array)));
        
        const audioDataUri = `data:audio/wav;base64,${base64String}`;
        
        return {
            text: textToSpeak,
            audioDataUri: audioDataUri,
            voiceProfileId: voiceToUse,
        };

    } catch (error: any) {
        console.error("Client-side OpenTTS fetch failed:", error);
        const errorMessage = `Could not connect to the local OpenTTS server. Please ensure the server is running and accessible at ${openTtsUrl}. (Details: ${error.message})`;
        return {
            text: textToSpeak,
            audioDataUri: `tts-flow-error:${errorMessage}`,
            errorMessage: errorMessage,
            voiceProfileId: voiceToUse,
        };
    }
}

    