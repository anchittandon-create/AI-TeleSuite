// mock-tts-server.ts
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 5500; // Using the port the app is already configured to call

app.use(cors());
app.use(express.json());

// Load a sample WAV file
const wavPath = path.join(__dirname, 'dummy.wav'); 
let wavFile: Buffer;

try {
  wavFile = fs.readFileSync(wavPath);
} catch (error) {
  console.error("******************************************************************");
  console.error("FATAL: Could not read 'dummy.wav'.");
  console.error("Please ensure a valid, short .wav file named 'dummy.wav' exists in the 'src/ai/flows' directory.");
  console.error("The mock server cannot start without it.");
  console.error("******************************************************************");
  process.exit(1); // Exit if the dummy file is missing
}


// TTS endpoint
app.post('/api/tts', (req, res) => {
  if (!req.body.text) {
    console.warn("Mock TTS received request without text body.");
    return res.status(400).json({ error: "Text is required in the request body." });
  }
  console.log(`Mock TTS received text: "${req.body.text}"`);
  res.set({
    'Content-Type': 'audio/wav',
    'Content-Length': wavFile.length,
  });
  res.send(wavFile);
});

// Health check
app.get('/', (_, res) => res.send('Mock TTS Server Running'));

app.listen(PORT, () => {
  console.log(`✅ Mock TTS Server listening at http://localhost:${PORT}`);
  console.log("Endpoint available at http://localhost:5500/api/tts");
});
