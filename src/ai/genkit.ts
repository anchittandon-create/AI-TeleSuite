
import {genkit, FlowInput, FlowOutput} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import {decode} from 'js-base64';

// Load environment variables from .env file
config();

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found";
  if (key.length < 10) return "Too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// New, more robust way to handle service account credentials from environment variables.
// The service account JSON is expected to be Base64-encoded in the .env file.
let serviceAccountCredentials;
if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
    try {
        const decodedString = decode(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64);
        serviceAccountCredentials = JSON.parse(decodedString);
    } catch (e) {
        console.error("🚨 CRITICAL: Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64. Ensure it's a valid Base64-encoded JSON string.", e);
    }
}


console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);
if (serviceAccountCredentials) {
    console.log(`- Service Account credentials loaded successfully from environment variable.`);
    console.log(`- Service Account Client Email: ${serviceAccountCredentials.client_email}`);
    console.log(`- Text-to-Speech (TTS) services will use these credentials.`);
} else {
    console.warn(`- ⚠️ WARNING: GOOGLE_SERVICE_ACCOUNT_BASE64 not found in environment.`);
    console.warn(`- TTS services require service account credentials and will likely fail.`);
}

if (geminiApiKey) {
    console.log(`- Using API Key: ${getMaskedApiKey(geminiApiKey)} for generative models.`);
} else {
    console.error(`🚨 CRITICAL: GEMINI_API_KEY / GOOGLE_API_KEY not found.`);
    console.error(`🔴 Core AI features WILL FAIL. Set the API key in your environment.`);
}
console.log(`--- End Genkit Initialization ---\n`);


export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: geminiApiKey,
      // Pass the parsed credentials directly to the plugin configuration.
      // This is the most reliable way to ensure authentication for services like TTS.
      credentials: serviceAccountCredentials,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

