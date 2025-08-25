
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { serviceAccount } from './key';


// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found in Environment";
  if (key.length < 10) return "Key is too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

// Use the standard server-side environment variable.
const geminiApiKey = process.env.GOOGLE_API_KEY || serviceAccount.private_key;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);
console.log(`- Using Google API Key for server-side Genkit flows.`);

if (!geminiApiKey) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY is not set in the environment (.env file) and no service account key is available. All AI features WILL FAIL.`);
}

export const ai = genkit({
  plugins: [
    // Explicitly pass the API key to the Google AI plugin.
    // This is a robust way to ensure authentication and bypasses potential issues
    // with how different server environments load process.env.
    googleAI({ apiKey: geminiApiKey }),
  ],
  logLevel: 'warn', // Changed to 'warn' to reduce console noise, can be set to 'debug' for more detail
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
