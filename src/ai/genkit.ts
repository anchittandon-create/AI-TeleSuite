import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This is the standard server-side environment variable that the googleAI() plugin
// is configured to look for automatically.
const geminiApiKey = process.env.GOOGLE_API_KEY;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);

if (!geminiApiKey) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY is not defined in the environment. Server-side AI features WILL FAIL.`);
} else {
    console.log(`- Genkit server-side flows will use the GOOGLE_API_KEY environment variable for authentication.`);
}

export const ai = genkit({
  plugins: [
    // The googleAI() plugin automatically looks for GOOGLE_API_KEY or GEMINI_API_KEY
    // in the environment. No explicit configuration is needed here if the variable is set.
    googleAI(),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
