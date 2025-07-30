
import {genkit, FlowInput, FlowOutput} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import * as path from 'path';
import fs from 'fs';


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
// This is the standard way to provide credentials for server-side Google Cloud services.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`- GOOGLE_APPLICATION_CREDENTIALS is set. Genkit will use these service account credentials.`);
    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.error(`🚨 CRITICAL: key.json file specified in GOOGLE_APPLICATION_CREDENTIALS not found at: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        console.error(`🔴 AI features requiring Service Account authentication WILL FAIL.`);
    }
} else if (fs.existsSync(path.resolve(process.cwd(), 'key.json'))) {
    console.log(`- key.json found at project root. This will be used for Application Default Credentials if the environment variable is set.`);
    // Recommend setting the environment variable for robustness
    console.log(`- Recommendation: Set GOOGLE_APPLICATION_CREDENTIALS=./key.json in your .env.local file for consistent behavior.`);
} else {
    console.error(`🚨 CRITICAL: key.json not found and GOOGLE_APPLICATION_CREDENTIALS is not set.`);
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
