import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {serviceAccount} from './key';

// This is the standard server-side environment variable that the googleAI() plugin
// is configured to look for automatically. It can be used as a fallback if the service account
// is not provided, but the service account is the primary method for this app.
const geminiApiKey = process.env.GOOGLE_API_KEY;

console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);

// Validate that we have some form of authentication.
// The googleAI plugin will handle the logic of which to use,
// but we provide a clear developer log here.
if (!geminiApiKey && (!serviceAccount || !serviceAccount.private_key)) {
    console.error(`🚨 CRITICAL: GOOGLE_API_KEY or a service account key in key.json is not defined. Server-side AI features WILL FAIL.`);
} else if (serviceAccount && serviceAccount.private_key && serviceAccount.project_id !== 'your-google-cloud-project-id') {
     console.log(`- Genkit server-side flows will use the service account from key.json for authentication.`);
} else if (geminiApiKey) {
    console.log(`- Genkit server-side flows will use the GOOGLE_API_KEY environment variable for authentication (key.json not fully configured).`);
}


export const ai = genkit({
  plugins: [
    // Explicitly pass the service account to ensure it is used for authentication.
    // The googleAI() plugin will use this as the primary method.
    googleAI({
      serviceAccount
    }),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
