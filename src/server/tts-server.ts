
// src/server/tts-server.ts
import express from 'express';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
const port = 5500;

// Initialize the client. It will automatically use the
// GOOGLE_APPLICATION_CREDENTIALS environment variable if it's set.
const ttsClient = new TextToSpeechClient();

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

app.post('/api/tts', async (req, res) => {
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
    console.error('ERROR in TTS Server:', error);
    res.status(500).json({ 
        error: 'Failed to synthesize speech.', 
        details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`[TTS Server] Listening on http://localhost:${port}`);
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn("[TTS Server] WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. The server may not be able to authenticate with Google Cloud TTS.");
  } else {
    console.log(`[TTS Server] Using credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  }
});

export default app;
