
import { config } from 'dotenv';
config();

import '@/ai/flows/rebuttal-generator.ts';
import '@/ai/flows/call-scoring.ts';
import '@/ai/flows/pitch-generator.ts';
import '@/ai/flows/transcription-flow.ts'; // Added new transcription flow
import '@/ai/flows/training-deck-generator.ts'; // Added new training deck flow

