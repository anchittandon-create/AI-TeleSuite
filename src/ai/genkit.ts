
import {genkit, FlowInput, FlowOutput} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
config();

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found";
  if (key.length < 10) return "Too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const keyFilePath = path.join(process.cwd(), 'key.json');

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);
try {
    const keyFileContent = require(keyFilePath);
    console.log(`- Service Account credentials loaded successfully from key.json.`);
    console.log(`- Service Account Client Email: ${keyFileContent.client_email}`);
} catch (e) {
    console.warn(`- ⚠️ WARNING: Could not read key.json file. This may impact services like Text-to-Speech.`);
}


if (geminiApiKey) {
    console.log(`- Using API Key for generative models: ${getMaskedApiKey(geminiApiKey)}.`);
} else {
    console.error(`🚨 CRITICAL: GEMINI_API_KEY / GOOGLE_API_KEY not found.`);
    console.error(`🔴 Core AI features WILL FAIL. Set the API key in your environment.`);
}
console.log(`--- End Genkit Initialization ---\n`);


export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: geminiApiKey,
      // Pass the keyFilename directly to the plugin configuration.
      // This is the most reliable way to ensure authentication for all Google AI services.
      clientOptions: {
        keyFilename: keyFilePath
      }
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
