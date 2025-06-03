
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Check for the API key
if (!process.env.GOOGLE_API_KEY) {
  console.error("CRITICAL ERROR: GOOGLE_API_KEY is not set in the environment.");
  console.error("Please ensure GOOGLE_API_KEY is present in your .env file and the server is restarted.");
  console.error("Genkit Google AI plugin may not initialize correctly without it, leading to Internal Server Errors.");
  console.error("The application's AI features will not work until this is resolved.");
}

export const ai = genkit({
  plugins: [
    googleAI() // This will still attempt to initialize; if GOOGLE_API_KEY is missing, it will likely fail here or when used.
  ],
  model: 'googleai/gemini-2.0-flash', // Default model
});
