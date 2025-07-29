
import { config } from 'dotenv';
// Load environment variables at the very beginning
config(); 

import '@/ai/flows/rebuttal-generator.ts';
import '@/ai/flows/call-scoring.ts';
import '@/ai/flows/pitch-generator.ts';
import '@/ai/flows/transcription-flow.ts';
import '@/ai/flows/training-deck-generator.ts';
import '@/ai/flows/data-analyzer.ts';
import '@/ai/flows/speech-synthesis-flow.ts';
import '@/ai/flows/voice-sales-agent-flow.ts';
import '@/ai/flows/voice-support-agent-flow.ts';
import '@/ai/flows/product-description-generator.ts';
import '@/ai/flows/combined-call-scoring-analysis.ts';
import '@/ai/flows/speech-synthesis-opentts-flow.ts';
import '@/ai/flows/voice-sales-agent-option2-flow.ts';


console.log("Genkit development runner (src/ai/dev.ts) loaded. Environment variables configured. Ensure Genkit CLI is running separately if needed for local flow inspection.");
