
// This file is deprecated and no longer needed for the main application flow.
// It is kept for reference or future local testing needs.
// To run:
// 1. Make sure you have a real 'dummy.wav' file in this directory.
// 2. Run 'npm install express cors'
// 3. Run 'npm run tts-server'

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5500; // The port configured in .env

app.use(cors());
app.use(express.json());

// Load a sample WAV file
const wavPath = path.join(__dirname, 'dummy.wav');
let wavFile;

try {
  wavFile = fs.readFileSync(wavPath);
} catch (error) {
  console.error(`\n🔴 MOCK TTS SERVER ERROR: Could not read 'dummy.wav' at ${wavPath}`);
  console.error("🔴 Please create a placeholder 'dummy.wav' file in the 'src/ai/flows' directory for the mock server to run.");
  // Create a tiny, silent WAV file buffer as a fallback
  const silentWavHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00,
    0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
  ]);
  wavFile = silentWavHeader;
  console.log("🔴 Using a silent WAV fallback for now.\n");
}


// TTS endpoint
app.post('/api/tts', (req, res) => {
  console.log('✅ Mock TTS Server received request with text:', req.body.text);
  res.set({
    'Content-Type': 'audio/wav',
    'Content-Length': wavFile.length,
  });
  res.send(wavFile);
});

// Health check
app.get('/', (_, res) => res.send('Mock TTS Server Running'));

app.listen(PORT, () => {
  console.log(`\n✅ Mock TTS Server listening at http://localhost:${PORT}`);
  console.log(`   TTS endpoint available at POST http://localhost:${PORT}/api/tts\n`);
});
