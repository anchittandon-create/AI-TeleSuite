
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

let genkitCredentials: { client_email: string; private_key: string } | undefined = undefined;
let genkitCredentialsError: string | null = null;

try {
    const keyFilePath = path.resolve(process.cwd(), 'key.json');
    if (fs.existsSync(keyFilePath)) {
        const keyFileContent = fs.readFileSync(keyFilePath, 'utf-8');
        const credentials = JSON.parse(keyFileContent);
        
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        genkitCredentials = {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        };
        console.log(`- Service Account credentials for Genkit loaded directly from key.json.`);
    } else {
        throw new Error("key.json not found at project root. Genkit may rely on API Key only.");
    }
} catch (e: any) {
    genkitCredentialsError = `Could not load credentials from key.json for Genkit: ${e.message}`;
    console.warn(`- ⚠️ WARNING: ${genkitCredentialsError}`);
}

if (geminiApiKey) {
    console.log(`- Using API Key for generative models (Gemini): ${getMaskedApiKey(geminiApiKey)}.`);
} else {
    console.error(`🚨 CRITICAL: GEMINI_API_KEY / GOOGLE_API_KEY not found in environment.`);
    console.error(`🔴 Core AI features (Gemini) WILL FAIL. Set the API key in your environment.`);
}
console.log(`--- End Genkit Initialization ---\n`);


export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: geminiApiKey,
      credentials: genkitCredentials, // Pass the formatted credentials directly
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
