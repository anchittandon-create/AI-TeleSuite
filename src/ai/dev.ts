
// This file is used to load all the Genkit flows for development purposes.
// It ensures that when you run the Genkit development server, all your defined flows are registered.

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
import '@/ai/flows/browser-voice-agent-flow.ts';


import '@/ai/flows/generate-full-call-audio.ts';


console.log("Genkit development runner (src/ai/dev.ts) loaded. Ensure Genkit CLI is running separately if needed for local flow inspection.");
