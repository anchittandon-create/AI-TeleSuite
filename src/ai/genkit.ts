
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found in Environment";
  if (key.length < 10) return "Key is too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

// Explicitly use the provided Google API Key from the environment variable.
const geminiApiKey = process.env.GOOGLE_API_KEY;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);
console.log(`- Attempting to use GOOGLE_API_KEY: ${getMaskedApiKey(geminiApiKey)}`);

if (!geminiApiKey) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY is not set in the environment (.env file). All AI features WILL FAIL.`);
}

export const ai = genkit({
  plugins: [
    // Initialize the Google AI plugin with the specific API key.
    googleAI({ apiKey: geminiApiKey }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
