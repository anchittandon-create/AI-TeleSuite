
import {genkit} from 'genkit';
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

// Check for Application Default Credentials from key.json.
// This is now the primary authentication method for all Google AI services.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`- GOOGLE_APPLICATION_CREDENTIALS is set. Genkit will use these service account credentials for all applicable Google services (Gemini, TTS, etc.).`);
    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.error(`🚨 CRITICAL: key.json file specified in GOOGLE_APPLICATION_CREDENTIALS not found at: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        console.error(`🔴 All AI features WILL FAIL.`);
    }
} else if (fs.existsSync(path.resolve(process.cwd(), 'key.json'))) {
    console.log(`- key.json found at project root. This will be used for Application Default Credentials.`);
    // Recommend setting the environment variable for robustness
    console.log(`- Recommendation: For robust operation, set GOOGLE_APPLICATION_CREDENTIALS=./key.json in your .env file.`);
    // Set it for the current process if not already set
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), 'key.json');
} else {
    console.error(`🚨 CRITICAL: key.json not found and GOOGLE_APPLICATION_CREDENTIALS is not set. All Google Cloud AI features WILL FAIL.`);
}

if (geminiApiKey) {
    console.warn(`- WARNING: A GOOGLE_API_KEY is present in the environment but is NO LONGER USED for Google AI services. Authentication is now handled by the service account (key.json).`);
}

console.log(`--- End Genkit Initialization ---\n`);


export const ai = genkit({
  plugins: [
    // googleAI() will now automatically use the service account credentials
    // if GOOGLE_APPLICATION_CREDENTIALS is set, which we handle above.
    // No API key is needed here.
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
