
import {genkit, type GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

// Load environment variables from .env file
config();

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found";
  if (key.length < 10) return "Too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const geminiApiKey = process.env.GEMINI_API_KEY;
const googleAppCredsFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log(`\n--- Genkit Initialization Log (src/ai/genkit.ts) ---`);
console.log(`- Reading process.env.GEMINI_API_KEY: ${getMaskedApiKey(geminiApiKey)}`);
console.log(`- Reading GOOGLE_APPLICATION_CREDENTIALS (for Cloud services like TTS): ${googleAppCredsFromEnv ? `Set to '${googleAppCredsFromEnv}'` : "Not Set"}`);

if (!geminiApiKey) {
  console.error(`
🚨 CRITICAL WARNING: GEMINI_API_KEY is not available in the environment.
🔴 AI features powered by Gemini models (Pitch Gen, Scoring, etc.) WILL FAIL.
🔴 To fix, ensure GEMINI_API_KEY is set in your .env file and that it's loaded correctly, then restart the server.
`);
}

if (!googleAppCredsFromEnv) {
    console.warn(`
🟡 Genkit Warning: GOOGLE_APPLICATION_CREDENTIALS is NOT SET.
🟡 AI features powered by Google Cloud TTS WILL FAIL with a 403 Permission Denied error unless authentication is handled another way.
🟡 To fix, ensure you have a 'key.json' service account file in your project root, and add GOOGLE_APPLICATION_CREDENTIALS=./key.json to your .env file, then restart the server.
  `);
}
console.log(`--- End of Genkit Initialization Log ---\n`);


export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
