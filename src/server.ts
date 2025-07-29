
// src/server.ts
import express from 'express';
import { createServer } from 'http';
import next from 'next';
import cors from 'cors';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file at the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 9003;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Function to get Google credentials from environment variables
const getGoogleCredentials = () => {
    try {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
            const decodedString = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
            return JSON.parse(decodedString);
        }
        // As a fallback, check for the key file directly, useful for local dev without base64 encoding
        const keyPath = path.resolve(process.cwd(), 'key.json');
        if (require('fs').existsSync(keyPath)) {
            return require(keyPath);
        }
    } catch (e) {
        console.error("Failed to parse Google credentials:", e);
    }
    return undefined;
};

app.prepare().then(() => {
    const server = express();

    // Enable CORS for the TTS route
    server.use('/api/tts', cors());
    server.use(express.json());

    // TTS Route for the self-hosted engine
    server.post('/api/tts', async (req, res) => {
        const { text, voice, ssml } = req.body;
        
        if (!text) {
            return res.status(400).send('Missing text in request body');
        }

        try {
            const credentials = getGoogleCredentials();
            if (!credentials) {
                console.error("TTS Endpoint Error: Google service account credentials are not configured.");
                return res.status(500).send("TTS service credentials not configured on the server.");
            }

            const client = new TextToSpeechClient({ credentials });

            const request = {
                input: ssml ? { ssml: text } : { text: text },
                voice: {
                    languageCode: 'en-US',
                    // Use the provided voice name, or fallback. Ensure names are valid for WaveNet or Standard.
                    name: voice || 'en-US-Wavenet-F', 
                    ssmlGender: 'NEUTRAL' as const
                },
                audioConfig: {
                    audioEncoding: 'LINEAR16' as const, // Use LINEAR16 for WAV
                    sampleRateHertz: 24000,
                },
            };

            const [response] = await client.synthesizeSpeech(request);
            
            if (response.audioContent) {
                res.setHeader('Content-Type', 'audio/wav');
                const stream = new Readable();
                stream.push(response.audioContent);
                stream.push(null); // End of stream
                stream.pipe(res);
            } else {
                res.status(500).send('Failed to synthesize speech');
            }

        } catch (error) {
            console.error('TTS Synthesis Error:', error);
            res.status(500).send(`Failed to process TTS request. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    // Handle all other Next.js requests
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    createServer(server).listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> TTS server ready at http://${hostname}:${port}/api/tts`);
    });
});
