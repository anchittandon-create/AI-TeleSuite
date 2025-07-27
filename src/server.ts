
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import express from 'express';
import cors from 'cors';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 9003;

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize the TTS client. It will automatically use the
// GOOGLE_APPLICATION_CREDENTIALS environment variable if it's set.
const ttsClient = new TextToSpeechClient();

app.prepare().then(() => {
  const server = express();

  // Middleware
  server.use(express.json());
  server.use(cors()); // Basic CORS for all routes

  // Custom API route for TTS
  server.post('/api/tts', async (req, res) => {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text to speak is required.' });
    }

    const voiceToUse = voice || 'en-IN-Wavenet-D';

    const request = {
      input: { text: text },
      voice: { languageCode: 'en-IN', name: voiceToUse },
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    try {
      const [response] = await ttsClient.synthesizeSpeech(request);
      
      if (response.audioContent) {
        res.json({
          audioContent: Buffer.from(response.audioContent).toString('base64'),
        });
      } else {
        res.status(500).json({ error: 'No audio content received from TTS API.' });
      }
    } catch (error: any) {
      console.error('ERROR in TTS API route:', error);
      res.status(500).json({ 
          error: 'Failed to synthesize speech.', 
          details: error.message 
      });
    }
  });

  // Default handler for all other Next.js routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, (err?: any) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
     if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn("[Custom Server] WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. The server may not be able to authenticate with Google Cloud TTS.");
    } else {
        console.log(`[Custom Server] Using credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    }
  });
});
