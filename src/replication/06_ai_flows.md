# Replication Prompt: Part 6 - AI Flows & Backend Logic

This document provides the complete source code and logic for every Genkit AI flow in the application.

---

### **1. Genkit Setup**

#### **File: `src/ai/genkit.ts`**
```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const geminiApiKey = process.env.GOOGLE_API_KEY;

if (!geminiApiKey) {
    console.error(`CRITICAL: GOOGLE_API_KEY is not defined.`);
}

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});
```
**Purpose:** Initializes and configures the global Genkit `ai` object, enabling the Google AI plugin.

---

### **2. Pitch & Rebuttal Flows**

#### **File: `src/ai/flows/pitch-generator.ts`**
```typescript
'use server';
// ... (full content of pitch-generator.ts)
```
**Purpose:** Defines the `generatePitch` flow. The AI prompt instructs the model to act as a "world-class sales agent" and strictly use the provided `knowledgeBaseContext` (with specific category rules) and an optional `optimizationContext` to generate a structured sales pitch. It is authorized to use a `brandUrl` for fallback information.

---

#### **File: `src/ai/flows/rebuttal-generator.ts`**
```typescript
'use server';
// ... (full content of rebuttal-generator.ts)
```
**Purpose:** Defines the `generateRebuttal` flow. The AI prompt follows an "Acknowledge, Bridge, Benefit, Clarify/Question" model. Crucially, this file also contains the `generateFallbackRebuttal` function, a non-AI, rule-based algorithm that provides a high-quality response if the AI service fails, ensuring high availability.

---

### **3. Analysis & Scoring Flows**

#### **File: `src/ai/flows/transcription-flow.ts`**
```typescript
'use server';
// ... (full content of transcription-flow.ts)
```
**Purpose:** Defines the `transcribeAudio` flow. It uses a resilient, dual-model strategy, first trying `gemini-2.0-flash` and falling back to `gemini-1.5-flash-latest`. The prompt gives strict instructions for diarization (AGENT:/USER: only), transliteration of Hinglish, and exclusion of non-speech sounds.

---

#### **File: `src/ai/flows/call-scoring.ts`**
```typescript
'use server';
// ... (full content of call-scoring.ts)
```
**Purpose:** Defines the `scoreCall` flow. This is one of the most complex prompts, instructing the AI to act as an "exceptionally detailed telesales performance coach" and score a call against a rubric of over 75 specific metrics. It also employs a dual-model fallback for resilience.

---

#### **File: `src/ai/flows/combined-call-scoring-analysis.ts`**
```typescript
'use server';
// ... (full content of combined-call-scoring-analysis.ts)
```
**Purpose:** Defines two flows:
1.  `analyzeCallBatch`: Takes multiple call reports and synthesizes them into a single analysis, identifying trends and themes.
2.  `generateOptimizedPitches`: Takes the output of the combined analysis and feeds it as `optimizationContext` to the main `generatePitch` flow, creating data-driven, improved pitches.

---

### **4. Voice Agent Flows**

#### **File: `src/ai/flows/voice-sales-agent-flow.ts`**
```typescript
'use server';
// ... (full content of voice-sales-agent-flow.ts)
```
**Purpose:** Orchestrates the AI Voice Sales Agent. This file is critical for the agent's logic. It includes:
-   `conversationRouterPrompt`: A fast, lightweight prompt to classify user intent (e.g., continue pitch, answer question, handle objection).
-   Specialized prompts (`salesAnswerGeneratorPrompt`, `supportAnswerGeneratorPrompt`, `objectionHandlerPrompt`) for generating contextual responses from the knowledge base.
-   The main `runVoiceSalesAgentTurn` flow, which uses the router's output to decide whether to continue the pre-generated pitch or call a specialized prompt.

---

#### **File: `src/ai/flows/voice-support-agent-flow.ts`**
```typescript
'use server';
// ... (full content of voice-support-agent-flow.ts)
```
**Purpose:** Defines the `runVoiceSupportAgentQuery` flow. This is simpler than the sales agent, focused on providing factual answers from the knowledge base. The prompt instructs the AI to identify when a query requires live data or escalation to a human agent.

---

### **5. Other Utility Flows**

#### **File: `src/ai/flows/product-description-generator.ts`**
```typescript
'use server';
// ... (full content of product-description-generator.ts)
```
**Purpose:** A simple flow used on the "Products" page to generate a concise, one-sentence description for a product.

---

#### **File: `src/ai/flows/training-deck-generator.ts`**
```typescript
'use server';
// ... (full content of training-deck-generator.ts)
```
**Purpose:** Defines the `generateTrainingDeck` flow. The prompt includes two special-cased frameworks for "ET Prime – Sales Training Deck" and "Telesales Data Analysis Framework," which the AI will use if the input matches.

---

#### **File: `src/ai/flows/data-analyzer.ts`**
```typescript
'use server';
// ... (full content of data-analyzer.ts)
```
**Purpose:** Defines the `analyzeData` flow, which simulates a data analyst. The prompt is extensive, instructing the AI on how to simulate data cleaning, KPI calculation, and insight generation based *only* on the user's detailed textual description of their data files.