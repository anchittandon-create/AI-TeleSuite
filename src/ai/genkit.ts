
import {genkit, FlowInput, FlowOutput} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import * as path from 'path';
import fs from 'fs';


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

if (geminiApiKey) {
    console.log(`- Using API Key for generative models (Gemini): ${getMaskedApiKey(geminiApiKey)}.`);
}

// Check for Application Default Credentials from key.json
if (fs.existsSync(path.resolve(process.cwd(), 'key.json'))) {
    console.log(`- Service Account credentials found (key.json). Genkit will use Application Default Credentials.`);
} else {
    console.error(`🚨 CRITICAL: key.json not found at project root.`);
    console.error(`🔴 AI features requiring Service Account authentication WILL FAIL.`);
}

console.log(`--- End Genkit Initialization ---\n`);


export const ai = genkit({
  plugins: [
    googleAI(), // Initialize without parameters to use Application Default Credentials
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
