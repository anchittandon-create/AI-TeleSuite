
# AI_TeleSuite: Project Description for Replication

This document details the AI stack, logic, and implementation for various features of the AI_TeleSuite application, including core AI-driven modules and their corresponding dashboards. This is intended as a guide for replication.

## Core Application Technology Stack (General)

*   **Frontend Framework:** Next.js (v15.x) with React (v18.x) using the App Router.
*   **UI Components:** ShadCN UI, built on top of Radix UI and Tailwind CSS.
*   **Styling:** Tailwind CSS (configured via `tailwind.config.ts` and `src/app/globals.css`).
*   **Language:** TypeScript.
*   **State Management (Client-Side):** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), custom hooks for local storage (`useLocalStorage`, `useActivityLogger`, `useKnowledgeBase`, `useUserProfile`).
*   **AI Orchestration & Backend Logic (for data generation modules):** Genkit (v1.x), primarily using the `@genkit-ai/googleai` plugin. Genkit flows run within the Next.js server-side environment.
*   **AI Models (for data generation modules):** Google's Gemini models (e.g., `gemini-2.0-flash`, `gemini-1.5-flash-latest`) as configured within Genkit flows.
*   **Speech Synthesis (Simulated):** A Genkit flow (`speech-synthesis-flow.ts`) simulates TTS by returning text and a descriptive placeholder for an audio URI. No external TTS client is currently used.

---

## Feature Set 1: Core AI-Driven Modules

### 1.1. Audio Transcription

**Purpose & Overview:** Converts uploaded audio files to text with speaker diarization, time allotments, and accuracy assessment. Output is strictly English (Roman script), with Hinglish transliterated.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/transcription-flow.ts` (Exports: `transcribeAudio` function, `TranscriptionInput` Zod schema, `TranscriptionOutput` Zod schema).
*   **Frontend:** `/src/app/(main)/transcription/page.tsx` (Handles uploads, calls the flow, displays results).
*   **Supporting Libs:** `/src/lib/file-utils.ts` (for `fileToDataUrl`).

**AI Stack & Logic Implementation:**
1.  **Input to Frontend:** User uploads one or more audio files (MP3, WAV, M4A, etc.) via an `<input type="file">`.
2.  **Frontend Processing:**
    *   Client-side validation for file type and size (`MAX_AUDIO_FILE_SIZE`).
    *   Each valid `File` object is converted to a Base64 encoded Data URI using `fileToDataUrl`.
3.  **Input to Genkit Flow (`TranscriptionInput`):**
    *   `audioDataUri`: The Data URI string.
4.  **Genkit Flow Execution (`transcribeAudio` function wrapping `transcriptionFlow`):**
    *   The flow calls `ai.generate()` using the `googleai/gemini-2.0-flash` model (or similar audio-capable Gemini model).
    *   **Prompt:** An array containing:
        *   `{ media: { url: input.audioDataUri } }` (the audio data).
        *   `{ text: transcriptionPromptInstructions }` (a detailed string of instructions for the AI).
    *   **Key AI Instructions (`transcriptionPromptInstructions` Summary):**
        *   **Time Allotment & Structure:** Output segmented, time range (e.g., `[0 seconds - 15 seconds]`) on new line, speaker label + text on next.
        *   **Diarization Labels (ALL CAPS):** `RINGING:` (for IVR/pre-agent audio), `AGENT:`, `USER:`, `SPEAKER 1/2:` (fallback, switch to AGENT/USER if roles clarify).
        *   **Non-Speech Sounds:** In parentheses (e.g., `(Background Noise)`).
        *   **Language & Script (CRITICAL):** English (Roman script) ONLY. Hinglish words transliterated (e.g., "kya"). No Devanagari.
        *   **Accuracy Assessment:** AI self-assesses as "High", "Medium" (with reasons), or "Low" (with reasons).
        *   **Completeness:** Full transcript required.
    *   **Output Configuration for `ai.generate()`:**
        *   `output: { schema: TranscriptionOutputSchema, format: "json" }`
        *   `config: { temperature: 0.1, responseModalities: ['TEXT'] }`
5.  **Output from Genkit Flow (`TranscriptionOutput`):**
    *   `diarizedTranscript: string`
    *   `accuracyAssessment: string`
    *   Includes error handling for AI failures (returns structured error in `diarizedTranscript` and "Error" for `accuracyAssessment`).
6.  **Frontend Display:**
    *   Results displayed in `TranscriptionResultsTable` or a single card if one file.
    *   Transcript text, accuracy, and options to copy/download.
    *   Original audio playable (if available).
7.  **Activity Logging:** An entry is logged via `useActivityLogger` with `module: "Transcription"`, including `fileName` and the `transcriptionOutput`.

---

### 1.2. AI Call Scoring

**Purpose & Overview:** Analyzes call transcripts (derived from uploaded audio) for sales performance metrics, providing scores and feedback relevant to a specific product.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/call-scoring.ts` (Exports: `scoreCall` function, `ScoreCallInput` Zod schema, `ScoreCallOutput` Zod schema).
*   **Dependency:** Internally uses `transcribeAudio` from `/src/ai/flows/transcription-flow.ts`.
*   **Frontend:** `/src/app/(main)/call-scoring/page.tsx` (Handles uploads, product selection, calls the flow, displays report).
*   **UI Components:** `CallScoringForm`, `CallScoringResultsCard`, `CallScoringResultsTable`.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend:** User selects `Product Focus` (ET/TOI), uploads audio file(s), optionally enters `Agent Name`.
2.  **Frontend Processing:** Converts audio to Data URI.
3.  **Input to Genkit Flow (`ScoreCallInput`):**
    *   `audioDataUri: string`
    *   `product: Product` ("ET" or "TOI")
    *   `agentName?: string`
4.  **Genkit Flow Execution (`scoreCall` function wrapping `scoreCallFlow`):**
    *   **Step 1: Transcription (Internal Call):** Calls `transcribeAudio({ audioDataUri: input.audioDataUri })`.
        *   **Critical Error Handling:** If transcription fails (system error, AI error, or unusable transcript), the flow aborts scoring and returns a `ScoreCallOutput` reflecting the transcription failure (overallScore 0, categorization "Error").
    *   **Step 2: Scoring (If Transcription Succeeded):**
        *   Calls `ai.generate()` using `googleai/gemini-2.0-flash`.
        *   **Prompt:** Dynamically constructed string instructing AI to act as a "call quality analyst," including the `product` context, `agentName` (if provided), the full `diarizedTranscript`, and key scoring instructions.
        *   **Key AI Instructions for Scoring (Summary):**
            *   Evaluate against metrics: Opening & Rapport, Needs Discovery, Product Presentation (for specified `product`), Objection Handling, Closing, Clarity, Agent's Tone, User's Sentiment, Product Knowledge (for `product`).
            *   Provide overall score (1-5), categorization (e.g., "Very Good"), metric scores (1-5) & feedback.
            *   Provide summary, 2-3 strengths, 2-3 areas for improvement.
        *   **Output Configuration for `ai.generate()`:**
            *   `output: { schema: ScoreCallGenerationOutputSchema, format: "json" }` (subset of `ScoreCallOutputSchema`)
            *   `config: { temperature: 0.2 }`
        *   **Combining Results:** The scoring AI's output is combined with the transcript and accuracy from Step 1.
        *   **Error Handling (Scoring AI Call):** If scoring AI fails, returns `ScoreCallOutput` with successful transcript but error in scoring part.
5.  **Output from Genkit Flow (`ScoreCallOutput`):** Comprehensive object with `transcript`, `transcriptAccuracy`, `overallScore`, `callCategorisation`, `metricScores`, `summary`, `strengths`, `areasForImprovement`.
6.  **Frontend Display:** `CallScoringResultsCard` (single) or `CallScoringResultsTable` (multiple), showing detailed report.
7.  **Activity Logging:** Logs two entries:
    *   `module: "Transcription"` (with transcript and accuracy).
    *   `module: "Call Scoring"` (with `fileName`, `scoreOutput`, `agentNameFromForm`).

---

### 1.3. AI Pitch Generator

**Purpose & Overview:** Generates a sales pitch (headline, intro, benefits, CTA) optimized for a specific product and customer cohort, using uploaded product information and training data.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/pitch-generator.ts` (Exports: `generatePitch`, `GeneratePitchInput`, `GeneratePitchOutput`).
*   **Frontend:** `/src/app/(main)/pitch-generator/page.tsx` (Form for inputs, calls flow, displays `PitchCard`).
*   **UI Components:** `PitchForm`, `PitchCard`.
*   **Knowledge Base Hook:** `useKnowledgeBase` for fetching context.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend:** User selects `Product`, `Customer Cohort`, optional plan/offer details, agent/user names. Optionally uploads a "Direct Context File".
2.  **Frontend Processing:**
    *   If a direct file is uploaded:
        *   Its name and type are noted.
        *   If it's a small, readable text file (TXT, MD, CSV < 100KB), its content is read.
    *   General Knowledge Base context for the selected product is prepared via `prepareGeneralKnowledgeBaseContext`.
    *   The direct file context (metadata + optional content) is prioritized and prepended to the general KB context for the AI.
3.  **Input to Genkit Flow (`GeneratePitchInput`):**
    *   `product`, `customerCohort`, `etPlanConfiguration?`, `salesPlan?`, `offer?`, `agentName?`, `userName?`.
    *   `knowledgeBaseContext: string` (Combined context, prioritizing direct file info).
4.  **Genkit Flow Execution (`generatePitch` wrapping `generatePitchFlow`):**
    *   Calls `ai.generate()` using `googleai/gemini-1.5-flash-latest`.
    *   **Prompt:** Detailed instructions to act as a "GenAI-powered telesales assistant." Includes user inputs and the `knowledgeBaseContext`.
        *   **Key AI Instructions:**
            *   Strictly use `knowledgeBaseContext` (prioritizing any "UPLOADED FILE CONTEXT" section if present) for all product features, benefits, pricing.
            *   If "UPLOADED FILE CONTEXT" is present and AI cannot process the file type (where content wasn't pre-extracted), state this in `notesForAgent`.
            *   If context is sparse for any pitch section, state this in the section and refer agent to KB/source.
            *   Avoid repetition between pitch sections.
            *   Populate ALL fields in `GeneratePitchOutputSchema` distinctly.
            *   Format `fullPitchScript` as AGENT dialogue (450-600 words), integrating all components, using placeholders.
    *   **Output Configuration for `ai.generate()`:**
        *   `output: { schema: GeneratePitchOutputSchema, format: "json" }`
        *   `config: { temperature: 0.4 }`
5.  **Output from Genkit Flow (`GeneratePitchOutput`):** `pitchTitle`, `warmIntroduction`, `personalizedHook`, `productExplanation`, `keyBenefitsAndBundles`, `discountOrDealExplanation`, `objectionHandlingPreviews`, `finalCallToAction`, `fullPitchScript`, `estimatedDuration`, `notesForAgent?`. Includes error handling if KB is insufficient or AI fails.
6.  **Frontend Display:** `PitchCard` component displays all structured pitch elements and the full script.
7.  **Activity Logging:** `module: "Pitch Generator"`, logs `pitchOutput` and key input data.

---

### 1.4. AI Rebuttal Generator

**Purpose & Overview:** Provides real-time sales rebuttal suggestions based on customer objections and a knowledge base.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/rebuttal-generator.ts` (Exports: `generateRebuttal`, `GenerateRebuttalInput`, `GenerateRebuttalOutput`).
*   **Frontend:** `/src/app/(main)/rebuttal-generator/page.tsx` (Form for objection, calls flow, displays `RebuttalDisplay`).
*   **UI Components:** `RebuttalForm`, `RebuttalDisplay`.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend:** User selects `Product`, enters `Customer Objection`.
2.  **Frontend Processing:** Prepares `knowledgeBaseContext` for the selected product using `prepareKnowledgeBaseContext`.
3.  **Input to Genkit Flow (`GenerateRebuttalInput`):**
    *   `objection: string`
    *   `product: Product`
    *   `knowledgeBaseContext: string`
4.  **Genkit Flow Execution (`generateRebuttal` wrapping `generateRebuttalFlow`):**
    *   Calls `ai.generate()` using `googleai/gemini-2.0-flash`.
    *   **Prompt:** Instructs AI to act as a "telesales assistant" providing rebuttals. Includes `objection`, `product`, and `knowledgeBaseContext`.
        *   **Key AI Instructions:**
            *   Analyze core objection.
            *   Prioritize KB content for direct counters or relevant info. Synthesize, don't just list.
            *   Structure rebuttal: Acknowledge, Bridge (from KB), Benefit (from KB), Clarify/Question.
            *   If KB is sparse or objection vague: Acknowledge, use general conversational skills, pivot to general product strength (from KB if any), ask clarifying questions. DO NOT invent product info.
            *   Adapt length to objection complexity and KB richness.
            *   Maintain confident, helpful tone.
    *   **Output Configuration for `ai.generate()`:**
        *   `output: { schema: GenerateRebuttalOutputSchema, format: "json" }`
        *   `config: { temperature: 0.4 }`
5.  **Output from Genkit Flow (`GenerateRebuttalOutput`):**
    *   `rebuttal: string` (The AI-generated rebuttal text). Includes error handling for insufficient KB or AI failure.
6.  **Frontend Display:** `RebuttalDisplay` shows the generated rebuttal.
7.  **Activity Logging:** `module: "Rebuttal Generator"`, logs `rebuttalOutput` and input data.

---

### 1.5. Knowledge Base Updater (Content & Training Material Creator)

**Purpose & Overview:** Enables admin users to upload prompt/pitch/rebuttal files and audio. Also allows generation of training deck/brochure content using this KB.

**Knowledge Base Management (Frontend):**
*   **Relevant Files:** `/src/app/(main)/knowledge-base/page.tsx`, `KnowledgeBaseForm`, `KnowledgeBaseTable`.
*   **Logic:**
    *   Uses `useKnowledgeBase` hook (`localStorage`) to manage `KnowledgeFile` entries.
    *   `KnowledgeBaseForm` allows adding files (PDF, DOCX, TXT, CSV, audio, PPTX, XLSX etc.) or direct text entries.
        *   Files are not uploaded to a server; metadata (name, type, size) and, for text entries, content is stored in `localStorage`.
    *   Entries can be associated with `Product` and `CustomerCohort` (persona).
    *   `KnowledgeBaseTable` displays entries, allows viewing details and deletion.
    *   Option to download all core AI prompts as a text file.
*   **Activity Logging:** `module: "Knowledge Base Management"`, logs actions like 'add', 'delete', 'clear_all', 'download_full_prompts' with relevant file/entry details.

**Training Material Creator (AI Feature):**
*   **Purpose:** Generates structured text content for training decks or brochures.
*   **Relevant Files:** `/src/app/(main)/create-training-deck/page.tsx` (Frontend), `/src/ai/flows/training-deck-generator.ts` (Genkit Flow).
*   **AI Stack & Logic Implementation:**
    1.  **Input to Frontend:** User selects `Product`, `Output Format` (PDF, Word Doc, PPT, Brochure). Provides context via one of three methods:
        *   Direct Prompt: User types detailed instructions.
        *   Direct File Uploads: User uploads context files (metadata and small text content passed to AI).
        *   Selected KB Items: User selects existing entries from `useKnowledgeBase`.
        *   Option to use entire KB for the selected product.
    2.  **Frontend Processing:** Prepares `knowledgeBaseItems` array for the flow. For direct uploads or KB files, it passes name, type, and text content (if small text file/entry). For larger/binary files, mainly name/type are passed as context.
    3.  **Input to Genkit Flow (`GenerateTrainingDeckInput`):**
        *   `product`, `deckFormatHint`, `knowledgeBaseItems`, `generateFromAllKb`, `sourceDescriptionForAi`.
    4.  **Genkit Flow Execution (`generateTrainingDeck` wrapping `generateTrainingDeckFlow`):**
        *   Calls `ai.generate()` using `googleai/gemini-2.0-flash`.
        *   **Prompt:** Instructs AI to act as a "presentation and documentation specialist." Includes product, format, source description, and the `knowledgeBaseItems` context.
            *   **Key AI Instructions:**
                *   Special Case 1: If "ET Prime – Sales Training Deck" is clearly requested for ET, use a predefined 3-slide framework, fleshing it out with provided KB context.
                *   SpecialCase 2: If "Telesales Data Analysis Framework" is requested, use a predefined 9-section framework.
                *   General Case: Synthesize provided context into logical sections.
                *   Adapt content style (narrative/bullets) based on `deckFormatHint`.
                *   If context is sparse, state this and provide placeholders.
        *   **Output Configuration for `ai.generate()`:**
            *   `output: { schema: GenerateTrainingDeckOutputSchema, format: "json" }`
    5.  **Output from Genkit Flow (`GenerateTrainingDeckOutput`):** `deckTitle`, `sections: [{ title, content, notes? }]`.
    6.  **Frontend Display:** Results shown in an accordion view, with options to copy content or download as structured text (for PDF, Word, PPT).
    7.  **Activity Logging:** `module: "Create Training Material"`, logs `materialOutput` and `inputData`.

---

### 1.6. AI Data Analyst

**Purpose & Overview:** Analyzes telecalling data (described by the user) for insights, trends, and recommendations. The AI *simulates* data processing based on user descriptions.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/data-analyzer.ts` (Exports: `analyzeData`, `DataAnalysisInput`, `DataAnalysisReportOutput`).
*   **Frontend:** `/src/app/(main)/data-analysis/page.tsx` (Form for inputs, calls flow, displays `DataAnalysisResultsCard`).
*   **UI Components:** `DataAnalysisForm`, `DataAnalysisResultsCard`.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend:**
    *   User "uploads" context files (Excel, CSV, TXT, PDF, DOCX, ZIP). Only file names and types are sent to the AI, not full binary content for large files.
    *   User provides a detailed `userAnalysisPrompt` describing the files' structure, content, data decoding rules, specific file mappings, and analytical goals.
2.  **Frontend Processing:**
    *   If a CSV/TXT file is among the primary uploads, a small sample (first ~10k chars) is read as `sampledFileContent`.
3.  **Input to Genkit Flow (`DataAnalysisInput`):**
    *   `fileDetails: [{ fileName, fileType }]`
    *   `userAnalysisPrompt: string`
    *   `sampledFileContent?: string`
4.  **Genkit Flow Execution (`analyzeData` wrapping `dataAnalysisReportFlow`):**
    *   Calls `ai.generate()` using `googleai/gemini-2.0-flash`.
    *   **Prompt:** Extensive prompt instructing AI to act as an "advanced Excel analyst AI specializing in telesales." Includes `fileDetails`, `userAnalysisPrompt`, and `sampledFileContent`.
        *   **Key AI Instructions (Simulated Process):**
            *   **Data Reconstruction (Simulated):** Hypothetically clean data based on user's description of messiness.
            *   **Table Normalization (Simulated):** Conceptually reconstruct described sheets into clean tables.
            *   **Smart Table Recognition:** Infer purpose of described tables (CDR, MIS, etc.) from column names and user prompt.
            *   **KPI Calculation (Based on Description):** Calculate KPIs (Conversion Rate, Avg Revenue/Call, etc.) based on how user describes the data fields and outcome codes. If revenue is missing, infer performance from intent distribution.
            *   **Insight Generation:** Derive trends, comparative performance, use-case specific insights from the *simulated* clean data. Flag red flags if user's description implies data anomalies.
            *   Output must strictly adhere to `DataAnalysisReportSchema`.
            *   **Critical Disclaimer:** AI emphasizes that analysis is based on user's description and it hasn't processed full binary files.
    *   **Output Configuration for `ai.generate()`:**
        *   `output: { schema: DataAnalysisReportSchema, format: "json" }`
        *   `config: { temperature: 0.3 }`
5.  **Output from Genkit Flow (`DataAnalysisReportOutput`):** `reportTitle`, `executiveSummary`, `keyMetrics`, `detailedAnalysis` (with sub-sections for data reconstruction, table recognition, trends, etc.), `chartsOrTablesSuggestions?`, `recommendations`, `directInsightsFromSampleText?`, `limitationsAndDisclaimer`.
6.  **Frontend Display:** `DataAnalysisResultsCard` shows the structured report.
7.  **Activity Logging:** `module: "Data Analysis"`, logs `analysisOutput` and `inputData`.

---

### 1.7. AI Voice Sales Agent (Simulated Voice Interaction)

**Purpose & Overview:** Orchestrates a simulated voice sales call, integrating pitch generation, rebuttal generation, and (simulated) speech synthesis. Concludes with call scoring.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/voice-sales-agent-flow.ts` (Exports: `runVoiceSalesAgentTurn`, `VoiceSalesAgentFlowInput`, `VoiceSalesAgentFlowOutput`).
*   **Dependencies:** Uses `generatePitch`, `generateRebuttal`, `synthesizeSpeech` (simulated), `scoreCall`, `transcribeAudio` (for user input if audio were used, currently text).
*   **Frontend:** `/src/app/(main)/voice-sales-agent/page.tsx` (Handles call setup, user text input, displays conversation log and score).
*   **UI Components:** `VoiceSampleUploader` (conceptual), `ConversationTurn` component, `CallScoringResultsCard`.
*   **Types:** `ConversationTurn`, `SimulatedSpeechOutput`.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend (Call Setup):** User configures Agent Name, Customer Name & Mobile, Product, Cohort, optional Plan/Offer, and a conceptual Voice Profile ID.
2.  **Frontend Interaction Loop (`runVoiceSalesAgentTurn`):**
    *   The frontend sends an `action` to the Genkit flow (`START_CONVERSATION`, `PROCESS_USER_RESPONSE`, `GET_REBUTTAL`, `END_CALL_AND_SCORE`).
    *   User input is currently text-based (`currentUserInputText`). (If audio input were enabled, `transcribeAudio` would be used here).
3.  **Genkit Flow Execution (`voiceSalesAgentFlow`):**
    *   **Knowledge Base Context:** Prepared from `useKnowledgeBase` for the selected product.
    *   **State Management:** Maintains `conversationHistory` and `currentPitchState`.
    *   **`START_CONVERSATION`:**
        *   Calls `generatePitch` using KB context and setup parameters.
        *   If pitch generation fails, synthesizes an error message and sets `nextExpectedAction` to `END_CALL_NO_SCORE`.
        *   If successful, synthesizes the pitch's intro/hook using `synthesizeSpeech` (simulated, returns placeholder audio URI).
        *   Adds AI's turn to conversation log. Sets `nextExpectedAction` to `USER_RESPONSE`.
    *   **`PROCESS_USER_RESPONSE`:**
        *   Validates `currentPitchState`. If invalid, sends recovery message.
        *   If user input indicates transcription error (if transcription were active), asks user to repeat.
        *   Selects the next part of the generated pitch (product explanation, benefits, deal, CTA) based on conversation history.
        *   If no valid pitch parts remain, tries a recovery/general question.
        *   Synthesizes the selected AI response text using `synthesizeSpeech`.
        *   Adds AI's turn to conversation log. Sets `nextExpectedAction` based on whether it's the final pitch part.
    *   **`GET_REBUTTAL`:**
        *   Calls `generateRebuttal` with `currentUserInputText` (objection) and KB context.
        *   Synthesizes the rebuttal text using `synthesizeSpeech`.
        *   Adds AI's turn to conversation log. Sets `nextExpectedAction` to `USER_RESPONSE`.
    *   **`END_CALL_AND_SCORE`:**
        *   Constructs a full text transcript from `conversationTurns`.
        *   Calls `scoreCall` using a dummy audio URI (as scoring is based on the text transcript).
        *   Stores `callScoreOutput`. Synthesizes a closing message.
        *   Adds AI's final turn. Sets `nextExpectedAction` to `CALL_SCORED`.
    *   **Error Handling:** Catches errors from sub-flows (pitch, rebuttal, TTS simulation, scoring) and includes them in `errorMessage`. If TTS fails, `audioDataUri` in `currentAiSpeech` will be an error placeholder.
4.  **Output from Genkit Flow (`VoiceSalesAgentFlowOutput`):**
    *   `conversationTurns`, `currentAiSpeech?` (with text and placeholder audio URI), `generatedPitch?`, `rebuttalResponse?`, `callScore?`, `nextExpectedAction`, `errorMessage?`.
5.  **Frontend Display:**
    *   Conversation log using `ConversationTurnComponent`.
    *   User inputs text for their turn. Buttons for "Send Response", "Get Rebuttal", "End Call".
    *   `CallScoringResultsCard` displays score after call ends.
6.  **Activity Logging:** `module: "Voice Sales Agent"`, logs detailed `flowInput`, `flowOutput`, `finalScore`, `fullTranscriptText`, and any `error`.

---

### 1.8. AI Voice Support Agent (Simulated Voice Interaction)

**Purpose & Overview:** Simulates an AI voice support agent that answers user queries based on a knowledge base.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/voice-support-agent-flow.ts` (Exports: `runVoiceSupportAgentQuery`, `VoiceSupportAgentFlowInput`, `VoiceSupportAgentFlowOutput`).
*   **Dependencies:** `synthesizeSpeech` (simulated).
*   **Frontend:** `/src/app/(main)/voice-support-agent/page.tsx` (Handles setup, user query input, displays conversation).
*   **UI Components:** `VoiceSampleUploader` (conceptual), `ConversationTurn` component.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend (Setup & Query):** User configures Agent Name, optional Customer context, Product, conceptual Voice Profile ID. User types their query.
2.  **Frontend Interaction (`runVoiceSupportAgentQuery`):**
    *   Sends `userQuery` and setup parameters to the Genkit flow.
3.  **Genkit Flow Execution (`voiceSupportAgentFlow`):**
    *   **Knowledge Base Context:** Prepared from `useKnowledgeBase` for the selected product.
    *   **Core AI Call:** Calls `generateSupportResponsePrompt` (an internal `ai.definePrompt` call) using `googleai/gemini-1.5-flash-latest`.
        *   **Prompt:** Instructs AI to act as a "Customer Support Agent." Includes `product`, `userName?`, `userQuery`, and `knowledgeBaseContext`.
        *   **Key AI Instructions:**
            *   Prioritize KB for answers.
            *   If query needs live/personal data (not in static KB), state this, set `requiresLiveDataFetch: true`, and suggest how user might find it or offer escalation.
            *   If KB doesn't cover a general query, state this, set `isUnanswerableFromKB: true`, offer general help, or suggest escalation.
            *   Provide clear, professional, empathetic responses.
        *   **Output (from `generateSupportResponsePrompt`):** `{ responseText, requiresLiveDataFetch?, sourceMention?, isUnanswerableFromKB? }`.
    *   **Response Logic:**
        *   If `promptResponse` is empty or `responseText` is missing, generate a fallback error message for AI.
        *   If `requiresLiveDataFetch` or `isUnanswerableFromKB` is true, augment `responseText` to suggest escalation if not already present.
    *   **Speech Synthesis:** Calls `synthesizeSpeech` with `responseText` and `voiceProfileId` to get simulated audio output (text + placeholder URI).
    *   **Error Handling:** If `synthesizeSpeech` fails, its `errorMessage` is propagated. If the core prompt fails, a general error message is generated.
4.  **Output from Genkit Flow (`VoiceSupportAgentFlowOutput`):**
    *   `aiResponseText: string`
    *   `aiSpeech?: SimulatedSpeechOutput` (with text and placeholder audio URI)
    *   `escalationSuggested?: boolean`
    *   `sourcesUsed?: string[]`
    *   `errorMessage?: string`
5.  **Frontend Display:**
    *   Conversation log using `ConversationTurnComponent`. User inputs query, AI's response is added.
6.  **Activity Logging:** `module: "Voice Support Agent"`, logs `flowInput`, `flowOutput`, `fullTranscriptText`, and any `error`.

---

## Feature Set 2: Dashboards

Dashboards in AI_TeleSuite are primarily frontend modules that display data logged by the `useActivityLogger` hook. This hook stores `ActivityLogEntry` objects in the browser's `localStorage`. Dashboards use React state management, ShadCN UI components (Table, Dialog, etc.), and custom utility functions for filtering, sorting, and exporting data.

**Common Tech Stack for Dashboards:**
*   Next.js (App Router, Client Components)
*   React, TypeScript
*   `useActivityLogger` hook for accessing logged data.
*   ShadCN UI: `Table`, `Dialog`, `Button`, `Input`, `Select`, `Popover`, `Calendar`, `Badge`, `ScrollArea`, `Accordion`, `DropdownMenu`.
*   `date-fns` for date formatting and manipulation.
*   Custom export utilities: `/src/lib/export.ts` (CSV, plain text for DOC), `/src/lib/pdf-utils.ts` (PDF from text).

**General "View Result / View Details" Logic for Dashboards:**

The "View Result" (or "View Details," "Report") functionality across all dashboards follows a consistent pattern:

1.  **Data Source:** Each dashboard page (e.g., `/src/app/(main)/activity-dashboard/page.tsx`) fetches activity logs using `useActivityLogger` and then filters them based on the specific dashboard's purpose (e.g., only "Call Scoring" activities for the Call Scoring Dashboard).
2.  **Table Display:** The filtered and sorted data is displayed in a table (e.g., `ActivityTable`, `CallScoringDashboardTable`). Each row in the table represents an activity log and includes an "Actions" column containing a "View" (or similarly named) button.
3.  **State Management for Dialog:** The dashboard page component uses React's `useState` hook to manage two key pieces of state:
    *   `selectedItem`: Stores the `ActivityLogEntry` (or a transformed version of it) for the row whose "View" button was clicked. Initialized to `null`.
    *   `isDialogOpen`: A boolean that controls the visibility of the details dialog. Initialized to `false`.
4.  **"View" Button Click Handler:**
    *   Each "View" button in the table row has an `onClick` handler.
    *   This handler function (e.g., `handleViewDetails(item)`) receives the specific `ActivityLogEntry` (`item`) corresponding to that row.
    *   Inside the handler, `setSelectedItem(item)` is called to store the data for the dialog, and `setIsDialogOpen(true)` is called to open the dialog.
5.  **Dialog Component (`Dialog` from ShadCN UI):**
    *   The `Dialog` component is rendered conditionally based on the `isDialogOpen` state.
    *   Its `open` prop is bound to `isDialogOpen`, and its `onOpenChange` prop is bound to `setIsDialogOpen` (to handle closing the dialog via escape key or overlay click).
6.  **Dialog Content (`DialogContent`):**
    *   The content of the dialog dynamically displays the details from the `selectedItem`.
    *   This often involves passing the `selectedItem.details` object to a specific rendering component tailored for that module's data structure. For example:
        *   The Activity Dashboard uses `CallScoringResultsCard` for call scoring logs, `PitchCard` for pitch logs, etc.
        *   The Transcription Dashboard uses a `Textarea` to show the full transcript.
        *   The Call Scoring Dashboard uses `CallScoringResultsCard`.
        *   The Training Material Dashboard uses an `Accordion` to show generated sections.
        *   The Data Analysis Dashboard uses `DataAnalysisResultsCard`.
        *   Voice Agent Dashboards display interaction parameters and conversation logs.
    *   `Accordion` components are frequently used within dialogs to organize complex details into collapsible sections (e.g., "Input Parameters", "Generated Output", "Raw Details").
    *   `ScrollArea` is used for long content like transcripts or detailed reports.
7.  **Dialog Closure:** The dialog typically includes a "Close" `Button` in its `DialogFooter` that, when clicked, sets `isDialogOpen(false)`.

This pattern provides a user-friendly way to present a summary of activities in a table while offering access to comprehensive details on demand in a consistent modal/dialog interface.

---

### 2.1. Activity Dashboard

**Purpose & Overview:** Provides a comprehensive view of all activities logged across different modules of the application. Allows users to track interactions, filter by various criteria, and export logs.

**Relevant File:** `/src/app/(main)/activity-dashboard/page.tsx`
**UI Components:** `ActivityDashboardFilters`, `ActivityTable`.

**Logic & Implementation:**
1.  **Data Source:** Fetches all `activities` from `useActivityLogger`.
2.  **Filtering (`ActivityDashboardFilters`):**
    *   Users can filter by:
        *   Date Range (`dateFrom`, `dateTo`) using `Calendar` in `Popover`.
        *   Agent Name (text input).
        *   Module (dropdown populated with unique module names from activities).
        *   Product (dropdown with "ET", "TOI", "All").
    *   Filters are applied client-side to the `activities` array.
3.  **Display (`ActivityTable`):**
    *   Displays filtered and sorted activities in a table.
    *   Columns: Timestamp, Module, Product, Agent Name, Details Preview.
    *   Sorting: Clickable table headers for sorting by most columns.
    *   **Details Preview:** `getDetailsPreview()` function provides a concise summary of the `activity.details` object for quick viewing in the table.
    *   **View Full Details:** A "View" button opens a dialog (`Activity Details`) showing:
        *   Basic activity info (Module, Product, Agent, Timestamp).
        *   Rich display of `activity.details` based on the module (see "General 'View Result / View Details' Logic" above).
        *   Accordion sections for "Input Parameters / Context" (if applicable) and "Result / Output", plus a "Raw Details" fallback.
4.  **Exporting:**
    *   Dropdown menu with options: "Export as CSV (for Excel)", "Export Table as PDF", "Export Table as Text for Word (.doc)".
    *   Exports *currently filtered* table data.
    *   Uses `exportToCsv`, `exportTableDataToPdf`, `exportTableDataForDoc` from `/src/lib/export.ts`. Data includes Timestamp, Module, Product, Agent Name, Details Preview.
5.  **Output Format:**
    *   Interactive table with filtering and sorting.
    *   Detailed modal view for individual activity logs.
    *   Exported files in CSV, PDF, or DOC (text table) formats.

---

### 2.2. Transcription Dashboard

**Purpose & Overview:** Displays a history of all audio transcription activities, allowing users to review past transcripts.

**Relevant File:** `/src/app/(main)/transcription-dashboard/page.tsx`
**UI Component:** `TranscriptionDashboardTable`.

**Logic & Implementation:**
1.  **Data Source:** Filters `activities` from `useActivityLogger` where `module === "Transcription"`.
    *   Transforms these `ActivityLogEntry` objects into `HistoricalTranscriptionItem` (includes `fileName`, `transcriptionOutput`, `error?`).
2.  **Display (`TranscriptionDashboardTable`):**
    *   Table columns: File Name, Transcript Preview (first 150 chars), Accuracy Assessment, Date Transcribed.
    *   Sorting: Clickable headers for most columns.
    *   **View Full Transcript:** A "View" button opens a dialog showing:
        *   File name, date, accuracy assessment (with icon).
        *   Full `diarizedTranscript` in a scrollable `Textarea`.
        *   Buttons to Copy Text, Download TXT, Download PDF.
        *   Note: Original audio is *not* available for playback/download in this historical view to conserve storage.
3.  **Exporting (Table Data):**
    *   Dropdown menu for CSV, PDF, DOC export of the main table view.
    *   Exports Timestamp, Agent Name, Product, File Name, Accuracy Assessment, Transcript Preview, Error.
4.  **Output Format:**
    *   Table of transcription summaries.
    *   Modal for full transcript viewing and individual export.
    *   Table data export in CSV, PDF, DOC.

---

### 2.3. Call Scoring Dashboard

**Purpose & Overview:** Displays a history of all AI call scoring activities, allowing review of past scoring reports.

**Relevant File:** `/src/app/(main)/call-scoring-dashboard/page.tsx`
**UI Component:** `CallScoringDashboardTable`.

**Logic & Implementation:**
1.  **Data Source:** Filters `activities` from `useActivityLogger` where `module === "Call Scoring"`.
    *   Transforms into `HistoricalScoreItem` (includes `fileName`, `scoreOutput`, and `agentNameFromForm` if it was logged).
2.  **Display (`CallScoringDashboardTable`):**
    *   Table columns: File Name, Agent (prioritizes agent name from form if available, else profile agent), Product, Overall Score (stars + numeric), Categorization (badge), Transcript Accuracy (icon + text), Date Scored.
    *   Sorting: Clickable headers.
    *   **View Full Report:** "Report" button opens a dialog displaying the full `CallScoringResultsCard` for the selected item in a "historical view" mode (no audio playback).
3.  **Exporting (Table Data):**
    *   Dropdown menu for CSV, PDF, DOC export of the main table view.
    *   Exports Timestamp, Agent Name, Product, File Name, Overall Score, Categorization, Summary Preview, Transcript Accuracy.
4.  **Output Format:**
    *   Table of call score summaries.
    *   Modal for full `CallScoringResultsCard` view.
    *   Table data export in CSV, PDF, DOC.

---

### 2.4. Training Material Dashboard

**Purpose & Overview:** Displays a history of all generated training materials (decks/brochures).

**Relevant File:** `/src/app/(main)/training-material-dashboard/page.tsx`
**UI Component:** `TrainingMaterialDashboardTable`.

**Logic & Implementation:**
1.  **Data Source:** Filters `activities` from `useActivityLogger` where `module === "Create Training Material"`.
    *   Transforms into `HistoricalMaterialItem` (includes `materialOutput`, `inputData`, `error?`).
2.  **Display (`TrainingMaterialDashboardTable`):**
    *   Table columns: Material Title, Product, Format, Context Source (summary), Date Created.
    *   Sorting: Clickable headers.
    *   **View Material:** "View" button opens a dialog showing:
        *   Input parameters (Product, Format, Context Source description, list of context items with excerpts).
        *   Generated content (Title, Sections with content and notes) in an accordion view.
        *   Buttons to Copy Content, Download as PDF, Download as Text for Word (.doc).
        *   Note: Original uploaded context files are *not* available for download.
3.  **Exporting (Table Data):**
    *   Dropdown menu for CSV, PDF, DOC export of the main table view.
    *   Exports Timestamp, Agent Name, Product, Material Title, Format, Context Source summary, Error.
4.  **Output Format:**
    *   Table of material summaries.
    *   Modal for viewing generated material content and inputs.
    *   Table data export in CSV, PDF, DOC.

---

### 2.5. Data Analysis Dashboard

**Purpose & Overview:** Displays a history of all AI-generated data analysis reports.

**Relevant File:** `/src/app/(main)/data-analysis-dashboard/page.tsx`
**UI Component:** `DataAnalysisDashboardTable`.

**Logic & Implementation:**
1.  **Data Source:** Filters `activities` from `useActivityLogger` where `module === "Data Analysis"`.
    *   Transforms into `HistoricalAnalysisReportItem` (includes `inputData`, `analysisOutput?`, `error?`).
2.  **Display (`DataAnalysisDashboardTable`):**
    *   Table columns: Report Title, User Prompt (start), Files Context (count), Date Generated.
    *   Sorting: Clickable headers.
    *   **View Full Report:** "View" button opens a dialog displaying the full `DataAnalysisResultsCard` for the selected item.
    *   Individual report export options (PDF, Text for Word) within the dialog.
    *   Note: Original uploaded context files are *not* available for download.
3.  **Exporting (Table Data):**
    *   Dropdown menu for CSV, PDF, DOC export of the main table view.
    *   Exports Timestamp, Agent Name, Report Title, User Prompt Summary, File Context Count & Names, Error.
4.  **Output Format:**
    *   Table of report summaries.
    *   Modal for full `DataAnalysisResultsCard` view and individual report export.
    *   Table data export in CSV, PDF, DOC.

---

### 2.6. Voice Sales Agent Dashboard

**Purpose & Overview:** Displays logs of simulated AI voice sales calls, including transcripts and scores.

**Relevant File:** `/src/app/(main)/voice-sales-dashboard/page.tsx`

**Logic & Implementation:**
1.  **Data Source:** Filters `activities` from `useActivityLogger` where `module === "Voice Sales Agent"`.
    *   Transforms into `HistoricalSalesCallItem` (specialized `ActivityLogEntry` with `VoiceSalesAgentActivityDetails`).
2.  **Display (Table):**
    *   Table columns: Date, Customer (Name & Mobile), Product, Overall Score, Call Category, Status (Error/Completed), Actions.
    *   **View Details:** "View" button opens a dialog showing:
        *   Call setup parameters (AI Agent, Customer, Product, Cohort, Plan, Offer, Voice Profile ID).
        *   Full simulated conversation transcript (text).
        *   If call was scored, displays `CallScoringResultsCard`.
        *   Options to copy/download transcript.
    *   Note: Actual audio recordings are not stored or playable from this dashboard.
3.  **Exporting (Table Data):**
    *   Dropdown menu for CSV, PDF, DOC export of the main table view.
    *   Exports Timestamp, App Agent, AI Agent Name, Customer Name & Mobile, Product, Cohort, Overall Score, Call Category, Error.
4.  **Output Format:**
    *   Table of simulated call summaries.
    *   Modal for detailed view of parameters, transcript, and score.
    *   Table data export in CSV, PDF, DOC.

---

### 2.7. Voice Support Agent Dashboard

**Purpose & Overview:** Displays logs of simulated AI voice support interactions.

**Relevant File:** `/src/app/(main)/voice-support-dashboard/page.tsx`

**Logic & Implementation:**
1.  **Data Source:** Filters `activities` from `useActivityLogger` where `module === "Voice Support Agent"`.
    *   Transforms into `HistoricalSupportInteractionItem` (specialized `ActivityLogEntry` with `VoiceSupportAgentActivityDetails`).
2.  **Display (Table):**
    *   Table columns: Date, Customer, Product, Initial Query (preview), Escalation Suggested, Status (Error/Completed), Actions.
    *   **View Details:** "View" button opens a dialog showing:
        *   Context parameters (AI Agent, Customer, Product, Voice Profile ID, Initial Query).
        *   Full simulated conversation log (text).
        *   AI Response summary (text, sources used, escalation status).
        *   Options to copy/download interaction log.
    *   Note: Actual audio recordings are not stored or playable.
3.  **Exporting (Table Data):**
    *   Dropdown menu for CSV, PDF, DOC export of the main table view.
    *   Exports Timestamp, App Agent, AI Agent Name, Customer Name, Product, User Query (start), Escalation Suggested, Error.
4.  **Output Format:**
    *   Table of simulated interaction summaries.
    *   Modal for detailed view of parameters and conversation log.
    *   Table data export in CSV, PDF, DOC.

    