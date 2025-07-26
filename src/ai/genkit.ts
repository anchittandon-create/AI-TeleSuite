
import {genkit, type GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config();

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found";
  if (key.length < 10) return "Too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

let serviceAccount;
try {
  serviceAccount = require('../../key.json');
} catch (e) {
  // Gracefully handle cases where key.json might be missing
  // console.warn("Could not load key.json. Some services like TTS might not work without service account credentials.", e);
}


console.log(`\n--- Genkit Initialization Log (src/ai/genkit.ts) ---`);
console.log(`- Reading GEMINI_API_KEY: ${getMaskedApiKey(geminiApiKey)}`);

if (!geminiApiKey && !serviceAccount) {
  console.error(`
🚨 CRITICAL WARNING: Neither GEMINI_API_KEY nor a service account key (key.json) is available.
🔴 AI features powered by Gemini models (Pitch Gen, Scoring, etc.) WILL FAIL.
🔴 To fix, ensure GEMINI_API_KEY is set in your .env file or a valid key.json is in the project root, then restart the server.
`);
} else if (!geminiApiKey && serviceAccount) {
    console.log("- Using Service Account (key.json) for authentication.");
} else if (geminiApiKey) {
    console.log("- Using GEMINI_API_KEY for authentication.");
}

console.log(`--- End of Genkit Initialization Log ---\n`);


export const ai = genkit({
  plugins: [
    googleAI({
      // Use service account credentials if available, otherwise fall back to API key
      serviceAccount: serviceAccount ? serviceAccount : undefined,
      apiKey: geminiApiKey ? geminiApiKey : undefined
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
