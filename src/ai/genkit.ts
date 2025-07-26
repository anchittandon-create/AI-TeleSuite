
import {genkit, type GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not Found";
  if (key.length < 10) return "Too short to mask";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const geminiApiKeyFromEnv = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const googleAppCredsFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log(`\n--- Genkit Initialization Log (src/ai/genkit.ts) ---`);
console.log(`- Reading GEMINI_API_KEY (for LLMs like Gemini): ${getMaskedApiKey(geminiApiKeyFromEnv)}`);
console.log(`- Reading GOOGLE_APPLICATION_CREDENTIALS (for Cloud services like TTS): ${googleAppCredsFromEnv ? `Set to '${googleAppCredsFromEnv}'` : "Not Set"}`);

if (!geminiApiKeyFromEnv) {
  console.error(`
🚨 CRITICAL WARNING: GEMINI_API_KEY (or GOOGLE_API_KEY) is NOT SET.
🔴 AI features powered by Gemini models (Pitch Gen, Scoring, etc.) WILL FAIL.
🔴 To fix, add GEMINI_API_KEY=your_api_key to your .env file and restart the server.
`);
}

if (!googleAppCredsFromEnv) {
    console.warn(`
🟡 Genkit Warning: GOOGLE_APPLICATION_CREDENTIALS is NOT SET.
🟡 AI features powered by Google Cloud TTS WILL FAIL with a 403 Permission Denied error unless authentication is handled another way.
🟡 To fix, ensure you have a 'key.json' service account file in your project root, and add GOOGLE_APPLICATION_CREDENTIALS=./key.json to your .env file, then restart the server.
  `);
}
console.log(`--- End of Genkit Initialization Log ---\n`);

export const ai = genkit({
  plugins: [
    googleAI() // This plugin automatically uses both GEMINI_API_KEY and GOOGLE_APPLICATION_CREDENTIALS from the environment.
  ],
});
