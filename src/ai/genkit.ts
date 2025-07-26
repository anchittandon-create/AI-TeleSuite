
import {genkit} from 'genkit';
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

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

let serviceAccount;
try {
  serviceAccount = require('../../key.json');
} catch (e) {
  // This is not a critical error if an API key is present.
}

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);
if (serviceAccount) {
    console.log(`- Service Account (key.json) found and will be used for authentication.`);
} else {
    console.log(`- Service Account (key.json) not found. Falling back to API Key.`);
    if (geminiApiKey) {
        console.log(`- Using GEMINI_API_KEY: ${getMaskedApiKey(geminiApiKey)}`);
    } else {
        console.error(`🚨 CRITICAL: Neither key.json nor GEMINI_API_KEY is available.`);
        console.error(`🔴 AI features WILL FAIL. Set GEMINI_API_KEY in .env or provide key.json.`);
    }
}
console.log(`--- End Genkit Initialization ---\n`);

export const ai = genkit({
  plugins: [
    googleAI({
      // Prefer service account for auth, especially for services like TTS.
      // Fallback to API key if service account is not available.
      serviceAccount: serviceAccount,
      apiKey: !serviceAccount ? geminiApiKey : undefined,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
