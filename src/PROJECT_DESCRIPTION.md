
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
*   **Speech Synthesis (Simulated):** A Genkit flow (`speech-synthesis-flow.ts`) that calls a self-hosted Next.js API route (`/api/tts`) which in turn uses the Google Cloud Text-to-Speech API.

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
    *   The flow calls `ai.generate()` using the `googleai/gemini-2.0-flash` model.
    *   **Prompt:** An array containing:
        *   `{ media: { url: input.audioDataUri } }` (the audio data).
        *   `{ text: transcriptionPromptInstructions }` (a detailed string of instructions for the AI, see prompt in `transcription-flow.ts`).
    *   **Key AI Instructions (from `transcriptionPromptInstructions` Summary):**
        *   **Time Allotment & Structure:** Output segmented, time range (e.g., `[0 seconds - 15 seconds]`) on new line, speaker label + text on next.
        *   **Diarization Labels (ALL CAPS):** `RINGING:` (for IVR/pre-agent audio), `AGENT:`, `USER:`, `SPEAKER 1/2:` (fallback, switch to AGENT/USER if roles clarify).
        *   **Non-Speech Sounds:** In parentheses (e.g., `(Background Noise)`).
        *   **Language & Script (CRITICAL):** English (Roman script) ONLY. Hinglish words transliterated (e.g., "kya"). No Devanagari.
        *   **Accuracy Assessment:** AI self-assesses as "High", "Medium" (with reasons), or "Low" (with reasons).
        *   **Completeness:** Full transcript required.
    *   **Output Configuration for `ai.generate()`:**
        *   `output: { schema: TranscriptionOutputSchema }`
        *   `config: { temperature: 0.1, responseModalities: ['TEXT'] }`
5.  **Output from Genkit Flow (`TranscriptionOutput`):**
    *   `diarizedTranscript: string`
    *   `accuracyAssessment: string`
    *   Includes error handling for AI failures (returns structured error in `diarizedTranscript` and "Error" for `accuracyAssessment`).
6.  **Frontend Display:**
    *   Results displayed in `TranscriptionResultsTable` or a single card if one file.
    *   Transcript text, accuracy, and options to copy/download.
    *   Original audio playable (if available and not historical view).
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
    *   `transcriptOverride?: string` (Optional, to bypass internal transcription)
4.  **Genkit Flow Execution (`scoreCall` function wrapping `scoreCallFlow`):**
    *   **Step 1: Transcription (Internal Call or Override):**
        *   If `transcriptOverride` is provided, it is used directly.
        *   Otherwise, the flow calls `transcribeAudio({ audioDataUri: input.audioDataUri })`.
        *   **Critical Error Handling:** If transcription fails (system error, AI error, or unusable transcript), the flow aborts scoring and returns a `ScoreCallOutput` reflecting the transcription failure (overallScore 0, categorization "Error").
    *   **Step 2: Scoring (If Transcription Succeeded):**
        *   Calls `ai.generate()` using `googleai/gemini-1.5-flash-latest` (with a fallback to `gemini-2.0-flash` on quota errors).
        *   **Prompt:** Dynamically constructed string (see `scoringPromptText` in `call-scoring.ts`) instructing AI to act as a "call quality analyst," including the `product` context, `agentName` (if provided), the full `diarizedTranscript`, and key scoring instructions.
        *   **Key AI Instructions for Scoring (Summary):**
            *   Evaluate against metrics: Opening & Rapport, Needs Discovery, Product Presentation (for specified `product`), Objection Handling, Closing, Clarity, Agent's Tone, User's Perceived Sentiment, Product Knowledge (for `product`).
            *   Provide overall score (1-5), categorization (e.g., "Very Good"), metric scores (1-5) & feedback.
            *   Provide summary, 2-3 strengths, 2-3 areas for improvement.
        *   **Output Configuration for `ai.generate()`:**
            *   `output: { schema: ScoreCallGenerationOutputSchema }` (subset of `ScoreCallOutputSchema`)
            *   `config: { temperature: 0.2 }`
        *   **Combining Results:** The scoring AI's output is combined with the transcript and accuracy from Step 1.
        *   **Error Handling (Scoring AI Call):** If scoring AI fails, returns `ScoreCallOutput` with successful transcript but error in scoring part.
5.  **Output from Genkit Flow (`ScoreCallOutput`):** Comprehensive object with `transcript`, `transcriptAccuracy`, `overallScore`, `callCategorisation`, `metricScores`, `summary`, `strengths`, `areasForImprovement`.
6.  **Frontend Display:** `CallScoringResultsCard` (single) or `CallScoringResultsTable` (multiple), showing detailed report in a tabbed interface.
7.  **Activity Logging:** Logs two entries:
    *   `module: "Transcription"` (with transcript and accuracy).
    *   `module: "Call Scoring"` (with `fileName`, `scoreOutput`, `agentNameFromForm`).

---
### 1.2.1. Combined Call Scoring Analysis

**Purpose & Overview:** Analyzes a batch of call scoring reports to provide an aggregated summary of performance, themes, and trends across multiple calls.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/combined-call-scoring-analysis.ts` (Exports: `analyzeCallBatch` function, `CombinedCallAnalysisInputSchema` Zod schema, `CombinedCallAnalysisReportSchema` Zod schema).
*   **Dependency:** Processes outputs from `scoreCall` flow.
*   **Frontend:** `/src/app/(main)/combined-call-analysis/page.tsx` (Handles product selection, analysis goal, finds historical data, calls combined analysis flow, displays combined report).
*   **UI Components:** `CombinedCallAnalysisResultsCard`.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend:** User selects `Product Focus` and optionally an `Overall Analysis Goal`.
2.  **Frontend Processing (Orchestration on `page.tsx`):**
    *   **Step A: Fetch Historical Scores:**
        *   The component filters `activities` from the `useActivityLogger` hook to find all historical `Call Scoring` logs that match the selected `Product`.
        *   It constructs an array of `IndividualCallScoreDataItem`.
        *   If fewer than 2 valid reports are found, it displays an error to the user.
    *   **Step B: Combined Analysis Call:**
        *   If enough reports are found, it prepares the `CombinedCallAnalysisInput`: `{ callReports: IndividualCallScoreDataItem[], product: Product, overallAnalysisGoal?: string }`.
        *   It then calls the `analyzeCallBatch` server action.
3.  **Genkit Flow Execution (`analyzeCallBatch` function wrapping `combinedCallAnalysisFlow`):**
    *   The flow calls `ai.generate()` using `googleai/gemini-1.5-flash-latest` (for larger context capacity).
    *   **Prompt:** A detailed prompt (see `combined-call-scoring-analysis.ts`) instructing the AI to act as a "call quality supervisor and data analyst." It receives summaries of all individual call reports (scores, categorizations, summaries, strengths, weaknesses, metric scores, and transcript excerpts).
    *   **Key AI Instructions for Combined Analysis (Summary):**
        *   Synthesize information from all individual reports.
        *   Calculate `averageOverallScore` for the batch.
        *   Determine `overallBatchCategorization`.
        *   Write a `batchExecutiveSummary`.
        *   List `commonStrengthsObserved` and `commonAreasForImprovement` across the batch.
        *   Identify `keyThemesAndTrends` with descriptions and frequencies.
        *   Summarize `metricPerformanceSummary` across key metrics for the batch (qualitative assessment and average scores if possible).
        *   Optionally provide `individualCallHighlights` for 2-3 notable calls.
    *   **Output Configuration for `ai.generate()`:**
        *   `output: { schema: CombinedCallAnalysisReportSchema, format: "json" }`
        *   `config: { temperature: 0.3 }`
4.  **Output from Genkit Flow (`CombinedCallAnalysisReportOutput`):** A structured object containing the aggregated analysis as per `CombinedCallAnalysisReportSchema`.
5.  **Frontend Display (`CombinedCallAnalysisResultsCard`):**
    *   Displays the combined report, using accordions or sections for:
        *   Report Title, Product Focus, Number of Calls, Average Score, Batch Categorization.
        *   Executive Summary.
        *   Common Strengths & Areas for Improvement.
        *   Key Themes and Trends.
        *   Metric Performance Summary.
        *   Individual Call Highlights (with links/buttons to view full individual reports).
    *   Allows viewing of individual `ScoreCallOutput` reports in a dialog (reusing `CallScoringResultsCard`).
6.  **Activity Logging:**
    *   A single, final activity for `module: "Combined Call Analysis"` logging the `CombinedCallAnalysisInput` (excluding full transcripts from input array, but including file names and individual scores) and the `CombinedCallAnalysisReportOutput`.

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
    *   Calls `ai.generate()` using `googleai/gemini-1.5-flash-latest` (with a fallback to `gemini-2.0-flash`).
    *   **Prompt:** Detailed instructions to act as a "GenAI-powered telesales assistant." Includes user inputs and the `knowledgeBaseContext`. See prompt in `pitch-generator.ts`.
        *   **Key AI Instructions:**
            *   Strictly use `knowledgeBaseContext` (prioritizing any "UPLOADED FILE CONTEXT" section if present) for all product features, benefits, pricing.
            *   If "UPLOADED FILE CONTEXT" is present and AI cannot process the file type (where content wasn't pre-extracted), state this in `notesForAgent`.
            *   If context is sparse for any pitch section, state this in the section and refer agent to KB/source file.
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
    *   Calls `ai.generate()` using `googleai/gemini-2.0-flash` (with fallback to `gemini-1.5-flash-latest`).
    *   **Prompt:** Instructs AI to act as a "telesales assistant" providing rebuttals. Includes `objection`, `product`, and `knowledgeBaseContext`. See prompt in `rebuttal-generator.ts`.
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
        *   **Prompt:** Instructs AI to act as a "presentation and documentation specialist." Includes product, format, source description, and the `knowledgeBaseItems` context. See prompt in `training-deck-generator.ts`.
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
    *   **Prompt:** Extensive prompt instructing AI to act as an "advanced Excel analyst AI specializing in telesales." Includes `fileDetails`, `userAnalysisPrompt`, and `sampledFileContent`. See prompt in `data-analyzer.ts`.
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

**Purpose & Overview:** Orchestrates a simulated voice sales call, integrating pitch generation, rebuttal generation, and (simulated) speech synthesis. Concludes with call scoring. This version uses the self-hosted TTS API for high-quality voices.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/voice-sales-agent-flow.ts` (Exports: `runVoiceSalesAgentTurn`).
*   **Dependencies:** Uses `generatePitch`, `generateRebuttal`, `synthesizeSpeech`, `scoreCall`.
*   **Frontend:** `/src/app/(main)/voice-sales-agent/page.tsx` (Handles call setup, user text/voice input, displays conversation log and score).
*   **UI Components:** `ConversationTurn` component, `CallScoringResultsCard`.
*   **Types:** `ConversationTurn`, `SynthesizeSpeechOutput`.

**AI Stack & Logic Implementation:**
1.  **Input to Frontend (Call Setup):** User configures Agent Name, Customer Name, Product, Cohort, optional Plan/Offer, and a Voice Profile ID.
2.  **Frontend Interaction Loop (`processAgentTurn`):**
    *   The frontend sends an `action` to the Genkit flow (`START_CONVERSATION`, `PROCESS_USER_RESPONSE`, `GET_REBUTTAL`, `END_CALL_AND_SCORE`).
    *   User input is handled by `useWhisper` hook (for voice) or a text input.
3.  **Genkit Flow Execution (`runVoiceSalesAgentTurn`):**
    *   **Knowledge Base Context:** Prepared from `useKnowledgeBase` for the selected product.
    *   **State Management:** Maintains `conversationHistory` and `currentPitchState`.
    *   **`START_CONVERSATION`:**
        *   Calls `generatePitch` using KB context and setup parameters.
        *   If pitch generation fails, synthesizes an error message.
        *   If successful, synthesizes the pitch's intro/hook using `synthesizeSpeech`.
        *   Adds AI's turn to conversation log. Sets `nextExpectedAction` to `USER_RESPONSE`.
    *   **`PROCESS_USER_RESPONSE`:**
        *   Selects the next part of the generated pitch (product explanation, benefits, etc.) based on conversation history using `getNextPitchSection` helper.
        *   Synthesizes the selected AI response text using `synthesizeSpeech`.
        *   Adds AI's turn to conversation log.
    *   **`GET_REBUTTAL`:**
        *   Calls `generateRebuttal` with `currentUserInputText` (objection) and KB context.
        *   Synthesizes the rebuttal text using `synthesizeSpeech`.
        *   Adds AI's turn to conversation log.
    *   **`END_CALL_AND_SCORE`:**
        *   Constructs a full text transcript from `conversationTurns`.
        *   Calls `scoreCall` using the text transcript (`transcriptOverride`).
        *   Stores `callScoreOutput`. Synthesizes a closing message.
    *   **Error Handling:** Catches errors from sub-flows and includes them in `errorMessage`.
4.  **Output from Genkit Flow (`VoiceSalesAgentFlowOutput`):** `conversationTurns`, `currentAiSpeech?`, `generatedPitch?`, `rebuttalResponse?`, `callScore?`, `nextExpectedAction`, `errorMessage?`.
5.  **Frontend Display:** Conversation log, user input controls, and `CallScoringResultsCard` after call ends.

---

### 1.8. Batch Audio Downloader

**Purpose & Overview:** Allows users to download multiple audio files simultaneously by providing a list of direct URLs or an Excel file containing URLs in a specific column. Files are bundled into a ZIP archive for download.

**Relevant Files:**
*   **Frontend:** `/src/app/(main)/batch-audio-downloader/page.tsx`
*   **UI Components:** Custom form elements within the page.
*   **Libraries:** `jszip` (for client-side ZIP creation), `xlsx` (for Excel file parsing).

**Logic & Implementation:**
1.  **Input to Frontend:**
    *   User chooses "Paste URLs" or "Upload Excel".
    *   User provides a list of URLs or an Excel file with column/sheet name.
2.  **Frontend Processing & URL Extraction:**
    *   `xlsx` library reads Excel files and extracts URLs from the specified column.
    *   `JSZip` is used to create a zip archive in the browser.
3.  **Batch Downloading & Zipping (Client-Side):**
    *   `fetch` is used to download each audio file.
    *   **CORS Handling:** Success depends on the CORS policy of the audio hosting server. The UI warns the user about this.
    *   Successfully fetched blobs are added to the `JSZip` instance.
4.  **ZIP Generation & Download Trigger:**
    *   `zip.generateAsync({ type: 'blob' })` creates the final ZIP file blob.
    *   A temporary `<a>` link is created with `URL.createObjectURL(zipBlob)` to trigger the download.
5.  **Activity Logging:** Logs initiation, success (with counts), or failure of the download process.

---

## Feature Set 2: Dashboards

Dashboards in AI_TeleSuite are primarily frontend modules that display data logged by the `useActivityLogger` hook. This hook stores `ActivityLogEntry` objects in the browser's `localStorage`.

**Common Tech Stack for Dashboards:**
*   Next.js (App Router, Client Components), React, TypeScript
*   `useActivityLogger` hook for accessing logged data.
*   ShadCN UI: `Table`, `Dialog`, `Button`, `Select`, `Accordion`, etc.
*   `date-fns` for date formatting.
*   Custom export utilities: `/src/lib/export.ts`, `/src/lib/pdf-utils.ts`.

**General "View Details" Logic:**
1.  **Data Source:** Each dashboard page fetches activity logs using `useActivityLogger` and filters them based on the dashboard's `module`.
2.  **Table Display:** Filtered data is displayed in a table (e.g., `ActivityTable`, `CallScoringDashboardTable`).
3.  **State Management for Dialog:** `useState` hook manages `selectedItem` and `isDialogOpen`.
4.  **"View" Button Handler:** On click, `setSelectedItem(item)` and `setIsDialogOpen(true)`.
5.  **Dialog Content:** The `Dialog` component renders details from the `selectedItem`, often reusing a primary feature's results card (e.g., `CallScoringResultsCard`, `PitchCard`).
6.  **Dialog Closure:** A "Close" button sets `isDialogOpen(false)`.

This pattern provides a consistent user experience for viewing activity history across the application.
