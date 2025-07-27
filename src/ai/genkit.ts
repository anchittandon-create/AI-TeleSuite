
import {genkit, FlowInput, FlowOutput} from 'genkit';
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
  // This ensures the path is resolved correctly from the project root.
  const serviceAccountPath = require.resolve('../../key.json');
  serviceAccount = require(serviceAccountPath);
  // Explicitly set the environment variable for Google Application Credentials.
  // This is the standard and most reliable way for Google Cloud libraries to find credentials.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
} catch (e) {
  // This is not a critical error if an API key is present for non-TTS services.
}

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);
if (serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`- Service Account (key.json) found and GOOGLE_APPLICATION_CREDENTIALS path is set.`);
    console.log(`- Service Account Client Email: ${serviceAccount.client_email}`);
    console.log(`- Libraries like Cloud TTS will now use this service account for authentication.`);
} else {
    console.log(`- Service Account (key.json) not found. Falling back to API Key if available.`);
    if (geminiApiKey) {
        console.log(`- Using GEMINI_API_KEY: ${getMaskedApiKey(geminiApiKey)}`);
        console.warn(`- ⚠️ WARNING: Text-to-Speech (TTS) services require a service account (key.json) and will likely fail with an API Key.`);
    } else {
        console.error(`🚨 CRITICAL: Neither key.json nor a GEMINI_API_KEY is available.`);
        console.error(`🔴 AI features WILL FAIL. Set GEMINI_API_KEY in .env or provide key.json.`);
    }
}
console.log(`--- End Genkit Initialization ---\n`);

// By relying on the environment variable, this plugin configuration becomes simpler and more robust.
// It will automatically use the service account if the env var is set, otherwise it will use the API key.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: geminiApiKey,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
