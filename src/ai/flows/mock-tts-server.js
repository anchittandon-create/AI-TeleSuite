// To run this server for local development:
// 1. Make sure you have a real 'dummy.wav' file in this directory.
// 2. Run 'npm install express cors' if you haven't already.
// 3. In your terminal, run 'node src/ai/flows/mock-tts-server.js' or 'npm run tts-server'.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5500; // The port the main app expects

// IMPORTANT: Configure CORS to allow requests from your specific Cloud Workstation URL.
// The Next.js app runs on port 9003, which is forwarded to a public URL.
const allowedOrigins = [
    'https://9003-firebase-studio-1747674027809.cluster-ubrd2huk7jh6otbgyei4h62ope.cloudworkstations.dev'
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// Load a sample WAV file to serve
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

// The TTS endpoint that the main application calls
app.post('/api/tts', (req, res) => {
  console.log('✅ Mock TTS Server received request with text:', req.body.text);
  res.set({
    'Content-Type': 'audio/wav',
    'Content-Length': wavFile.length,
  });
  res.send(wavFile);
});

// Health check endpoint
app.get('/', (_, res) => res.send('Mock TTS Server is running and healthy.'));

app.listen(PORT, () => {
  console.log(`\n✅ Mock TTS Server listening at http://localhost:${PORT}`);
  console.log(`   TTS endpoint available at POST http://localhost:${PORT}/api/tts`);
  console.log(`   CORS is configured to allow requests from specific origins.`);
});
