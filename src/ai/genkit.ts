
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This is the standard server-side environment variable that the googleAI() plugin
// is configured to look for automatically.
const geminiApiKey = process.env.GOOGLE_API_KEY;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);

if (!geminiApiKey) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY is not set in the environment (.env file). All server-side AI features (pitch generation, scoring, etc.) WILL FAIL.`);
} else {
    console.log(`- Genkit server-side flows will use the GOOGLE_API_KEY from the environment.`);
}

export const ai = genkit({
  plugins: [
    // The googleAI() plugin automatically finds and uses the GOOGLE_API_KEY from the environment.
    // There is no need to pass it explicitly.
    googleAI(),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
