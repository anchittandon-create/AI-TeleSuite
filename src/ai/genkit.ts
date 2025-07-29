
import {genkit, FlowInput, FlowOutput} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import * as path from 'path';

// Load environment variables from .env files
config({ path: '.env.local' });
config();

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found";
  if (key.length < 10) return "Too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);

// Check for GOOGLE_APPLICATION_CREDENTIALS which is now the primary auth method for server-side services like TTS
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`- Service Account credentials configured via GOOGLE_APPLICATION_CREDENTIALS.`);
} else {
    console.warn(`- ⚠️ WARNING: GOOGLE_APPLICATION_CREDENTIALS is not set. Server-side services like TTS may fail.`);
}

if (geminiApiKey) {
    console.log(`- Using API Key for generative models (Gemini): ${getMaskedApiKey(geminiApiKey)}.`);
} else {
    console.error(`🚨 CRITICAL: GEMINI_API_KEY / GOOGLE_API_KEY not found in environment.`);
    console.error(`🔴 Core AI features (Gemini) WILL FAIL. Set the API key in your environment.`);
}
console.log(`--- End Genkit Initialization ---\n`);


export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: geminiApiKey,
      // Removed keyFilename. The client will now automatically use the
      // GOOGLE_APPLICATION_CREDENTIALS environment variable.
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
