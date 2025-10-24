
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This is the standard server-side environment variable that the googleAI() plugin
// is configured to look for automatically.
const geminiApiKey = process.env.GOOGLE_API_KEY;

// Validate that the API key is available (silent check)
if (!geminiApiKey) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY not defined. AI features will fail.`);
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1',
    }),
  ],
});
