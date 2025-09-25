
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This is the standard server-side environment variable that the googleAI() plugin
// is configured to look for automatically.
const geminiApiKey = process.env.GOOGLE_API_KEY;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);

// Validate that the API key is available.
if (!geminiApiKey) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY environment variable is not defined. Server-side AI features WILL FAIL.`);
} else {
    console.log(`- Genkit server-side flows will use the GOOGLE_API_KEY environment variable for authentication.`);
}

export const ai = genkit({
  plugins: [
    // The googleAI plugin automatically uses the GOOGLE_API_KEY environment variable if it's set.
    // No explicit configuration is needed if the key is in the environment.
    googleAI(),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
