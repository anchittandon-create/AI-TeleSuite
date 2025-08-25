
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { serviceAccount } from './key'; // Import the service account key

// This is the standard server-side environment variable that the googleAI() plugin
// is configured to look for automatically for any features that might still use it.
const geminiApiKey = process.env.GOOGLE_API_KEY;
// The public key for client-side operations, referenced here for clarity but used in tts-client.ts
const nextPublicApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;


console.log(`\n--- Genkit Initialization (src/ai/genkit.ts) ---`);

if (!serviceAccount || !serviceAccount.project_id) {
    console.error(`🚨 CRITICAL: Service account key (src/ai/key.json) is missing or malformed. Server-side AI features WILL FAIL.`);
} else {
    console.log(`- Genkit server-side flows will use Service Account credentials from src/ai/key.json for authentication.`);
}

if (!nextPublicApiKey) {
    console.warn(`- WARNING: NEXT_PUBLIC_GOOGLE_API_KEY is not set. Client-side features like real-time voice synthesis previews will fail.`);
} else {
     console.log(`- Genkit client-side features (like TTS) will use the NEXT_PUBLIC_GOOGLE_API_KEY.`);
}


export const ai = genkit({
  plugins: [
    // Initialize the Google AI plugin with the service account for robust server-side authentication.
    // This is the recommended approach for server-to-server communication.
    googleAI({
        auth: {
            credentials: {
                client_email: serviceAccount.client_email,
                private_key: serviceAccount.private_key,
            }
        }
    }),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});

console.log(`--- End Genkit Initialization ---\n`);
