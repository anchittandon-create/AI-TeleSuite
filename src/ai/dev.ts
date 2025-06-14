
import { config } from 'dotenv';
config(); // To load .env file for GOOGLE_API_KEY if not already loaded by Next.js

import '@/ai/flows/rebuttal-generator.ts';
import '@/ai/flows/call-scoring.ts';
import '@/ai/flows/pitch-generator.ts';
import '@/ai/flows/transcription-flow.ts';
import '@/ai/flows/training-deck-generator.ts';
import '@/ai/flows/data-analyzer.ts';
import '@/ai/flows/speech-synthesis-flow.ts';
import '@/ai/flows/voice-sales-agent-flow.ts';
import '@/ai/flows/voice-support-agent-flow.ts';


console.log("Genkit development runner (src/ai/dev.ts) loaded. Ensure Genkit CLI is running separately if needed for local flow inspection.");

