
# AI_TeleSuite: Feature Deep Dive & Technical Implementation

This document provides a detailed technical description of AI_TeleSuite's features (excluding Voice Agent modules). It outlines the AI tech stack integration, feature creation procedures, data flows, and Genkit flow internals, explaining how to understand the system's current implementation.

## Core Technical Stack

*   **Frontend:** Next.js (App Router), React, TypeScript, ShadCN UI components, Tailwind CSS.
*   **AI Orchestration & Model Interaction:** Genkit (`@genkit-ai/googleai` plugin).
*   **AI Models:** Google's Gemini family of models (e.g., Gemini 1.5 Flash, Gemini 2.0 Flash for specific tasks like transcription) accessed via the Genkit Google AI plugin.
*   **State Management (Client-side):** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), supplemented by custom hooks for local storage (`useLocalStorage`) for features like `useKnowledgeBase` and `useActivityLogger`.
*   **Data Persistence (Client-side):** Browser `localStorage` is used for the Knowledge Base and Activity Log.
*   **Development Environment:** Firebase Studio (implying Node.js runtime for Next.js).

## Genkit Integration Overview (`src/ai/genkit.ts`)

*   **Initialization:** The `src/ai/genkit.ts` file initializes a global `ai` instance of Genkit.
    *   It configures Genkit to use the `googleAI()` plugin. This plugin handles authentication (expecting `GOOGLE_API_KEY` or `GEMINI_API_KEY` in environment variables) and communication with Google's AI services.
    *   Error handling during initialization ensures that if the API key is missing or Genkit fails to start, the application uses a fallback `ai` object whose methods will throw descriptive errors, preventing silent failures of AI features.
*   **Core Genkit Primitives Used:**
    *   `ai.defineFlow(name, inputSchema, outputSchema, async (input) => { ... })`: Defines an executable AI workflow. These flows typically orchestrate one or more calls to AI models (prompts) or tools.
    *   `ai.definePrompt(name, input, output, prompt, model, config)`: Defines a reusable prompt template. It specifies input/output schemas (Zod), the prompt string (using Handlebars templating `{{{...}}}`), the target AI model, and configurations like `temperature`.
    *   `ai.defineTool(...)`: (Not explicitly used in the described non-voice features but available in Genkit) Defines functions the AI model can choose to call to get external information or perform actions.
    *   `z` (Zod): Used extensively to define strict input and output schemas for flows and prompts, ensuring data integrity and providing structure for AI interactions.

## General Principle: Knowledge-Driven AI & Prompt Engineering

A central principle in AI_TeleSuite is that the AI's performance is heavily reliant on:
1.  **The Quality of the Knowledge Base (KB):** For features like Pitch Generation, Rebuttal Assistance, and Training Material Creation, the primary method of "training" or guiding the AI is by populating and maintaining a comprehensive, accurate, and well-structured Knowledge Base. The AI is explicitly instructed in its prompts to treat the provided KB content as its source of truth.
2.  **Effective Prompt Engineering:** The prompts defined in each Genkit flow are carefully crafted to:
    *   Assign a role to the AI (e.g., "You are a GenAI-powered telesales assistant...").
    *   Clearly define its task.
    *   Provide all necessary context (user inputs, KB content) via Handlebars templates.
    *   Specify the desired output structure using Zod schemas (the descriptions in Zod schemas are often passed to the AI to guide its output format).
    *   Instruct the AI on how to handle missing or sparse information (e.g., not to invent facts).

---

## Module 1: AI Pitch Generator

**1.1. Purpose & Overview:**
Generates tailored sales pitches for specific products (ETPrime or TOI+) aimed at defined customer cohorts. It leverages information from the Knowledge Base and user-provided parameters to create a structured, persuasive sales script.

**1.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/pitch-generator/page.tsx`
    *   Form: `src/components/features/pitch-generator/pitch-form.tsx` (uses `react-hook-form` with Zod schema `PitchFormValues`)
    *   Display: `src/components/features/pitch-generator/pitch-card.tsx`
*   **AI Orchestration:** Genkit (`src/ai/genkit.ts`)
*   **Genkit Flow:** `src/ai/flows/pitch-generator.ts` (exports `generatePitch` function)
*   **AI Model:** `googleai/gemini-1.5-flash-latest` (or similar powerful text generation model configured in the flow)

**1.3. Feature Creation Procedure & Data Flow:**

1.  **User Input (UI - `PitchForm`):**
    *   User selects: Product (`ET` or `TOI`), Customer Cohort.
    *   User can optionally provide: ET Plan Configuration (if product is ET), Sales Plan, specific Offer details, Agent Name, Customer Name.
    *   User can optionally upload a "Direct Context File" (e.g., PDF, DOCX, TXT).

2.  **Frontend Logic (`pitch-generator/page.tsx` - `handleGeneratePitch`):**
    *   Form data is validated against `PitchFormValues`.
    *   **Knowledge Base Context Preparation:**
        *   **If Direct Context File is Uploaded:**
            *   The file is processed client-side. If it's a readable text type (TXT, MD, CSV under 100KB), its content is read.
            *   A special `directFileInstructions` block is created, including the file name, type, and its text content (if read). This block is marked as "--- START OF UPLOADED FILE CONTEXT (PRIMARY SOURCE) ---".
            *   This `directFileInstructions` string becomes the primary part of the `knowledgeBaseContext`.
        *   **General Knowledge Base Content:**
            *   The `prepareGeneralKnowledgeBaseContext` helper function is called. It filters entries from `useKnowledgeBase` (localStorage) relevant to the selected `product` and `customerCohort`.
            *   Text content from these KB entries is concatenated, with truncation limits per item and total context length, forming the `generalKbContent`.
        *   **Final `knowledgeBaseContext`:** If a direct file was used, its context is prepended to the `generalKbContent`. Otherwise, only `generalKbContent` is used.
    *   An `GeneratePitchInput` object is constructed, containing all user selections and the prepared `knowledgeBaseContext`.

3.  **Genkit Flow Invocation:**
    *   The `generatePitch(fullInput)` function from `src/ai/flows/pitch-generator.ts` is called.

4.  **Genkit Flow Execution (`generatePitchFlow` in `pitch-generator.ts`):**
    *   **Input:** Receives `GeneratePitchInput` (validated against `GeneratePitchInputSchema`).
    *   **Initial KB Check:** Checks if the `knowledgeBaseContext` is too sparse (especially if no direct file was provided). If so, it returns a pre-defined error/placeholder output without calling the AI model.
    *   **Prompt Invocation:** Calls the `generatePitchPrompt` (defined using `ai.definePrompt`).
        *   **`generatePitchPrompt` Details:**
            *   **Input Schema:** `GeneratePitchInputSchema` (Zod schema for the input object).
            *   **Output Schema:** `GeneratePitchOutputSchema` (Zod schema for the expected structured JSON output from the AI). The descriptions within this schema guide the AI on what to populate in each field.
            *   **Prompt Text (Core Logic):**
                *   Sets the AI's role: "You are a GenAI-powered telesales assistant...".
                *   Includes placeholders for all inputs: `{{{product}}}`, `{{{customerCohort}}}`, `{{{salesPlan}}}`, `{{{offer}}}`, `{{{agentName}}}`, `{{{userName}}}`, `{{{etPlanConfiguration}}}`, and critically `{{{knowledgeBaseContext}}}`.
                *   **Critical Instructions to AI:**
                    *   To treat `knowledgeBaseContext` as the *ONLY* source of truth.
                    *   To prioritize any "--- START OF UPLOADED FILE CONTEXT ---" block if present.
                    *   Instructions on how to handle cases where an uploaded file's content cannot be directly processed (e.g., rely on metadata, inform the agent via `notesForAgent`).
                    *   To populate *EVERY* field of the `GeneratePitchOutputSchema`.
                    *   To **AVOID REPETITION** between different sections of the pitch. Each section (warm intro, hook, product explanation, benefits, etc.) must bring new and distinct information from the KB.
                    *   If KB context is sparse for a section, to state what information would typically go there and refer the agent to the full KB/source file.
                    *   Guidance on tone (conversational, confident, respectful).
            *   **AI Model:** `googleai/gemini-1.5-flash-latest`.
            *   **Configuration:** `temperature: 0.4` (for a balance of creativity and consistency), safety settings.
        *   The prompt call returns a response object containing the AI's structured output.
    *   **Error Handling:** If the AI model returns no output or a very short script, an error is thrown.
    *   **Output:** Returns the `GeneratePitchOutput` object (or an error structure if issues occurred).

5.  **Response Handling (UI - `pitch-generator/page.tsx` & `PitchCard`):**
    *   The frontend receives the `GeneratePitchOutput`.
    *   If the `pitchTitle` indicates a failure (e.g., "Pitch Generation Failed"), an error toast is shown.
    *   Otherwise, a success toast is displayed.
    *   The `PitchCard` component is rendered, which uses an Accordion to display the `fullPitchScript` (default open) and other distinct pitch components (`warmIntroduction`, `personalizedHook`, etc.).
    *   The `useActivityLogger` hook's `logActivity` function is called to record the interaction and its outcome.

**1.4. Knowledge Base Integration:**
*   The `knowledgeBaseContext` string is the primary data source for the AI.
*   It's constructed by `pitch-generator/page.tsx`.
*   **Priority:** If a "Direct Context File" is uploaded by the user:
    *   Its content (if plain text and small) or metadata (for binary/large files) is packaged with specific instructions for the AI to prioritize it. This is prepended to the general KB context.
    *   The AI is instructed to use this direct file content as the "ABSOLUTE PRIMARY SOURCE."
*   **Fallback:** If no direct file, or if the direct file context is insufficient, the AI uses the general KB content compiled from `useKnowledgeBase` (localStorage), filtered by product.
*   The AI prompt explicitly tells the model **NOT** to invent features or details not found in this provided context.

**1.5. Data Structures:**
*   `GeneratePitchInput` (defined in `pitch-generator.ts` and `types/index.ts`): Input to the Genkit flow.
*   `GeneratePitchOutput` (defined in `pitch-generator.ts` and `types/index.ts`): Structured output from the AI.
*   `PitchFormValues` (defined in `pitch-form.tsx`): Client-side form data structure.

**1.6. Error Handling:**
*   The `generatePitchFlow` includes `try...catch` blocks for AI call errors and input validation checks (e.g., sparse KB).
*   The frontend page uses `try...catch` for the flow invocation and `toast` notifications to display errors to the user.

---

## Module 2: AI Rebuttal Assistant

**2.1. Purpose & Overview:**
Provides contextual rebuttals to customer objections regarding ETPrime or TOI+ subscriptions. It relies exclusively on information sourced from the Knowledge Base for the selected product.

**2.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/rebuttal-generator/page.tsx`
    *   Form: `src/components/features/rebuttal-generator/rebuttal-form.tsx` (uses `react-hook-form` with Zod schema)
    *   Display: `src/components/features/rebuttal-generator/rebuttal-display.tsx`
*   **AI Orchestration:** Genkit (`src/ai/genkit.ts`)
*   **Genkit Flow:** `src/ai/flows/rebuttal-generator.ts` (exports `generateRebuttal` function)
*   **AI Model:** `googleai/gemini-2.0-flash` (or similar)

**2.3. Feature Creation Procedure & Data Flow:**

1.  **User Input (UI - `RebuttalForm`):**
    *   User selects: Product (`ET` or `TOI`).
    *   User inputs: Customer's objection (text).
    *   The form also offers buttons for common pre-defined objections to quickly populate the input.

2.  **Frontend Logic (`rebuttal-generator/page.tsx` - `handleGenerateRebuttal`):**
    *   Form data is validated.
    *   **Knowledge Base Context Preparation:**
        *   The `prepareKnowledgeBaseContext` helper function is called. It filters entries from `useKnowledgeBase` (localStorage) relevant to the selected `product`.
        *   Text content from these KB entries is concatenated to form the `knowledgeBaseContext`.
    *   A `GenerateRebuttalInput` object is constructed.

3.  **Genkit Flow Invocation:**
    *   The `generateRebuttal(fullInput)` function from `src/ai/flows/rebuttal-generator.ts` is called.

4.  **Genkit Flow Execution (`generateRebuttalFlow` in `rebuttal-generator.ts`):**
    *   **Input:** Receives `GenerateRebuttalInput` (validated against `GenerateRebuttalInputSchema`).
    *   **KB Check:** If `knowledgeBaseContext` indicates no relevant content was found, it returns a placeholder message.
    *   **Prompt Invocation:** Calls the `generateRebuttalPrompt`.
        *   **`generateRebuttalPrompt` Details:**
            *   **Input Schema:** `GenerateRebuttalInputSchema`.
            *   **Output Schema:** `GenerateRebuttalOutputSchema` (expects a single `rebuttal` string).
            *   **Prompt Text (Core Logic):**
                *   Role: "You are a GenAI-powered telesales assistant trained to provide quick, convincing rebuttals..."
                *   Task: Provide a professional, specific, and effective response to the customer's objection.
                *   Inputs: `{{{objection}}}`, `{{{product}}}`, `{{{knowledgeBaseContext}}}`.
                *   **Critical Instructions to AI:**
                    *   Understand the core objection.
                    *   **Prioritize Knowledge Base (KB) Content:** Search for highly relevant facts/features/themes in the KB that directly address the objection.
                    *   **Synthesize KB Info:** Transform KB points into a compelling argument, not just list facts.
                    *   **Structure (ABBC/Q):** Acknowledge, Bridge, Benefit (from KB), Clarify/Question.
                    *   **Handle Sparse KB:** If KB lacks a direct counter, acknowledge, pivot to a general strength (from KB if possible), and ask clarifying questions. Do NOT invent product features.
                    *   **Detail Level & Length:** Proportional to objection complexity and KB richness.
                    *   Tone: Confident, helpful, professional, understanding.
                    *   Strict KB Adherence for product facts.
            *   **AI Model:** `googleai/gemini-2.0-flash`.
            *   **Configuration:** `temperature: 0.4`.
        *   Returns the AI's generated rebuttal.
    *   **Error Handling:** If the AI returns no or a very short rebuttal, a fallback message is generated.
    *   **Output:** Returns `GenerateRebuttalOutput`.

5.  **Response Handling (UI - `rebuttal-generator/page.tsx` & `RebuttalDisplay`):**
    *   The frontend receives `GenerateRebuttalOutput`.
    *   A toast notification indicates success or failure.
    *   `RebuttalDisplay` shows the `rebuttal` text.
    *   Activity is logged via `useActivityLogger`.

**2.4. Knowledge Base Integration:**
*   The `knowledgeBaseContext` is the *sole* source for product-specific rebuttal points.
*   The prompt heavily emphasizes using and synthesizing information from this context.

**2.5. Data Structures:**
*   `GenerateRebuttalInput`, `GenerateRebuttalOutput` (from `rebuttal-generator.ts` and `types/index.ts`).

**2.6. Error Handling:**
*   Flow checks for empty KB context.
*   Flow provides a fallback if AI response is insufficient.
*   Frontend uses toasts for errors.

---

## Module 3: Audio Transcription

**3.1. Purpose & Overview:**
Transcribes uploaded audio files into text. It aims to perform speaker diarization (identifying different speakers, e.g., "AGENT:", "USER:") and segment the transcript with time allotments. It also handles transliteration of Hindi/Hinglish speech into Roman script.

**3.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/transcription/page.tsx`
    *   Component: `src/components/features/transcription/transcription-results-table.tsx` (for displaying multiple results)
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `src/ai/flows/transcription-flow.ts` (exports `transcribeAudio` function)
*   **AI Model:** `googleai/gemini-2.0-flash` (or a similar multimodal model capable of audio input, as specified in the flow)

**3.3. Feature Creation Procedure & Data Flow:**

1.  **User Input (UI - `transcription/page.tsx`):**
    *   User uploads one or more audio files (MP3, WAV, M4A, etc.).
    *   Client-side validation for file size (max 100MB per file) and allowed audio types.

2.  **Frontend Logic (`transcription/page.tsx` - `handleTranscribe`):**
    *   For each selected audio file:
        *   The `fileToDataUrl` utility converts the `File` object into a base64 encoded data URI string.
        *   A `TranscriptionInput` object (`{ audioDataUri }`) is created.
        *   The `transcribeAudio(input)` Genkit flow function is called.
    *   Results (or errors) for each file are collected.

3.  **Genkit Flow Execution (`transcriptionFlow` in `transcription-flow.ts`):**
    *   **Input:** Receives `TranscriptionInput` (validated against `TranscriptionInputSchema`).
    *   **Prompt Invocation:** Calls the `transcribeAudioPrompt`.
        *   **`transcribeAudioPrompt` Details:**
            *   **Input Schema:** `TranscriptionInputSchema` (includes `audioDataUri`).
            *   **Output Schema:** `TranscriptionOutputSchema` (expects `diarizedTranscript` and `accuracyAssessment`).
            *   **Prompt Text (Core Logic):**
                *   Primary instruction: "Transcribe the following audio with the utmost accuracy and diligence, strictly adhering to all instructions..."
                *   Audio Input: Uses `{{media url=audioDataUri}}` to pass the audio data to the Gemini model.
                *   **Critical Instructions to AI (Formatting & Content):**
                    *   **Time Allotment & Dialogue Structure:** Transcript must be segmented into chunks. Each chunk starts with a time allotment (e.g., `[0 seconds - 15 seconds]`) on a new line, followed by the speaker label and text on the next line.
                    *   **Diarization and Speaker Labels (ALL CAPS):** Specific rules for labeling:
                        *   "RINGING:" for initial ringing/IVR/automated messages.
                        *   "AGENT:" for the identifiable sales agent.
                        *   "USER:" for the customer.
                        *   "SPEAKER 1:", "SPEAKER 2:" as fallback if roles are ambiguous, with an instruction to switch to AGENT/USER if roles become clear.
                    *   **Language & Script (STRICT):** Entire transcript must be in English (Roman script). Hindi/Hinglish words MUST be accurately transliterated into Roman script (e.g., "aap kaise hain" not "आप कैसे हैं"). No Devanagari.
                    *   **Accuracy Assessment:** AI must provide a qualitative assessment ("High", "Medium due to [reason]", "Low due to [reason]") based on perceived audio quality and transcription confidence.
                    *   Completeness: Ensure the transcript is complete.
            *   **AI Model:** `googleai/gemini-2.0-flash` (or the latest model version suitable for audio transcription specified in the flow, currently `transcriptionModel` variable in the flow).
            *   **Configuration:** `temperature: 0.1` (for factual transcription), `responseModalities: ['TEXT']`.
        *   Returns the AI's structured transcription output.
    *   **Error Handling:** Catches errors from the AI model (e.g., API key issues, audio processing problems, safety blocks, timeouts). Returns a structured error object.
    *   **Output:** `TranscriptionOutput`.

4.  **Response Handling (UI - `transcription/page.tsx`):**
    *   The frontend receives an array of `TranscriptionResultItem` (which includes `TranscriptionOutput` and file info).
    *   If only one file was processed successfully, its transcript and details are shown in a dedicated card.
    *   If multiple files were processed, `TranscriptionResultsTable` displays a summary, with options to view full details for each.
    *   Toast notifications indicate success or failure for each file.
    *   Activity is logged for each file via `useActivityLogger` (`logBatchActivities`).

**3.4. Knowledge Base Integration:** Not directly applicable for this feature. The AI relies on its internal speech-to-text and language processing capabilities.

**3.5. Data Structures:**
*   `TranscriptionInput`, `TranscriptionOutput` (from `transcription-flow.ts` and `types/index.ts`).
*   `TranscriptionResultItem` (client-side in `transcription/page.tsx`).

**3.6. Error Handling:**
*   Client-side file validation.
*   Genkit flow has `try...catch` and returns specific error messages within the `TranscriptionOutput` structure if the AI fails (e.g., `[Transcription API Error...]`).
*   UI displays errors per file and uses toasts.

---

## Module 4: AI Call Scoring

**4.1. Purpose & Overview:**
Analyzes call transcripts (generated by the Audio Transcription module or derived from other sources) to provide an overall quality score, categorize call performance, and offer detailed feedback on various sales metrics. It uses the transcript and product context.

**4.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/call-scoring/page.tsx`
    *   Form: `src/components/features/call-scoring/call-scoring-form.tsx`
    *   Display: `src/components/features/call-scoring/call-scoring-results-card.tsx` (single result), `src/components/features/call-scoring/call-scoring-results-table.tsx` (multiple results)
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `src/ai/flows/call-scoring.ts` (exports `scoreCall` function). This flow internally calls the `transcription-flow.ts` first.
*   **AI Model:** `googleai/gemini-2.0-flash` (for scoring, after transcription by the model in `transcription-flow.ts`)

**4.3. Feature Creation Procedure & Data Flow:**

1.  **User Input (UI - `CallScoringForm`):**
    *   User selects: Product (`ET` or `TOI`).
    *   User uploads: One or more audio files of call recordings.
    *   User optionally inputs: Agent Name.

2.  **Frontend Logic (`call-scoring/page.tsx` - `handleAnalyzeCall`):**
    *   For each uploaded audio file:
        *   The file is converted to a `audioDataUri`.
        *   An `ScoreCallInput` object is created (`{ audioDataUri, product, agentName }`).
        *   The `scoreCall(input)` Genkit flow function is called.

3.  **Genkit Flow Execution (`scoreCallFlow` in `call-scoring.ts`):**
    *   **Input:** Receives `ScoreCallInput`.
    *   **Step 1: Transcription (Internal Call):**
        *   Calls `transcribeAudio({ audioDataUri: input.audioDataUri })` (from `transcription-flow.ts`).
        *   Handles errors from the transcription service. If transcription fails critically, it returns an error-structured `ScoreCallOutput` immediately.
    *   **Step 2: Scoring (If Transcription Succeeded):**
        *   Constructs `ScoreCallPromptInputSchema` containing the `transcript` from Step 1, `product`, and `agentName`.
        *   Calls the `scoreCallPrompt`.
            *   **`scoreCallPrompt` Details:**
                *   **Input Schema:** `ScoreCallPromptInputSchema`.
                *   **Output Schema:** `ScoreCallPromptOutputSchema` (which is `ScoreCallOutputSchema` minus `transcript` and `transcriptAccuracy`, as these come from the transcription step).
                *   **Prompt Text (Core Logic):**
                    *   Role: "You are an expert call quality analyst..."
                    *   Task: Objectively score the sales call based on the provided transcript and product context.
                    *   Inputs: `{{{transcript}}}`, `{{{product}}}`, `{{{agentName}}}`.
                    *   **Critical Instructions to AI:**
                        *   Evaluate against a list of metrics: Opening & Rapport, Needs Discovery, Product Presentation (relevant to `{{{product}}}`), Objection Handling, Closing Effectiveness, Clarity & Communication, Agent's Tone & Professionalism, User's Perceived Sentiment, Product Knowledge (specific to `{{{product}}}`).
                        *   Provide overall score (1-5), categorization, scores and detailed feedback for *each* metric.
                        *   Feedback should be specific and reference parts of the transcript.
                        *   Provide a summary, strengths, and areas for improvement.
                        *   Maintain objectivity.
                *   **AI Model:** `googleai/gemini-2.0-flash`.
                *   **Configuration:** `temperature: 0.2` (for more deterministic scoring).
            *   The prompt call returns the AI's structured scoring output.
        *   Handles errors if the scoring prompt fails.
    *   **Output:** Combines the transcription result (`transcript`, `transcriptAccuracy`) with the scoring prompt's output to form the final `ScoreCallOutput`.

4.  **Response Handling (UI - `call-scoring/page.tsx`):**
    *   The frontend receives an array of `ScoredCallResultItem`.
    *   Errors during the process (transcription or scoring) are captured in the `error` field of `ScoredCallResultItem` and/or reflected in the `ScoreCallOutput` structure (e.g., `callCategorisation: "Error"`).
    *   Results are displayed using `CallScoringResultsCard` (single) or `CallScoringResultsTable` (multiple).
    *   Toasts provide overall status.
    *   Activities for both "Call Scoring" and "Transcription" (if successful) are logged.

**4.4. Knowledge Base Integration:** Indirect. The AI scoring the call doesn't directly receive KB content. However, its evaluation of "Product Knowledge" relies on its general understanding of the product context (`ET` or `TOI`) provided in the input, which it uses to assess if the agent demonstrated correct product knowledge as per the transcript.

**4.5. Data Structures:**
*   `ScoreCallInput`, `ScoreCallOutput`, `MetricScoreSchema` (from `call-scoring.ts` and `types/index.ts`).
*   `TranscriptionOutput` (implicitly used via internal call).
*   `ScoredCallResultItem` (client-side).

**4.6. Error Handling:**
*   Extensive error handling within `scoreCallFlow` for both transcription and scoring phases, returning structured error outputs.
*   Frontend displays errors and uses toasts.

---

## Module 5: Knowledge Base Management

**5.1. Purpose & Overview:**
This module allows users to create, manage, and curate the informational backbone (Knowledge Base) that other AI features (Pitch Generator, Rebuttal Assistant, Training Material Creator) rely on. Users can upload documents (PDF, DOCX, TXT, CSV, audio, presentations, spreadsheets) and create direct text entries. Entries can be associated with products (ET/TOI) and customer personas/cohorts.

**5.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/knowledge-base/page.tsx`
    *   Form: `src/components/features/knowledge-base/knowledge-base-form.tsx`
    *   Table Display: `src/components/features/knowledge-base/knowledge-base-table.tsx`
*   **Data Persistence (Client-side):** `useKnowledgeBase` hook (`src/hooks/use-knowledge-base.ts`), which uses `useLocalStorage`.
*   **AI Orchestration/Model:** Not directly an AI generation feature itself, but it *feeds* AI features. Includes system-default text entries for ET Prime and TOI Plus product details which are themselves curated content.

**5.3. Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI - `KnowledgeBaseForm` & `KnowledgeBaseTable`):**
    *   **Adding Entries (`KnowledgeBaseForm`):**
        *   User selects "Entry Type": "Upload File(s)" or "Add Text/Prompt".
        *   Optionally selects "Associated Product" (ET/TOI) and "Target Persona/Cohort".
        *   If "Upload File(s)": User selects one or more files. Client-side validation for file size (50MB per file) and type (allows a broad range).
        *   If "Add Text/Prompt": User enters a "Name/Title" and "Text Content".
        *   User submits the form.
    *   **Managing Entries (`KnowledgeBaseTable`):**
        *   Users can view all KB entries.
        *   Users can delete entries.
        *   Users can view details of an entry (metadata and text content if applicable).
    *   **Special Actions:**
        *   "Export KB Log as CSV".
        *   "Clear All KB Entries".
        *   "Download Full AI Prompts & Logic" (downloads a static text file containing the core prompts of the application).

2.  **Frontend Logic (`knowledge-base/page.tsx` and `useKnowledgeBase` hook):**
    *   **Adding Single Text Entry (`handleAddSingleEntry` via `onSingleEntrySubmit` prop):**
        *   The `useKnowledgeBase` hook's `addFile` function is called.
        *   A new `KnowledgeFile` object is created with `isTextEntry: true`, `name` (from form), `textContent`, `type: "text/plain"`, `size` (length of text), `product`, `persona`, a generated `id`, and `uploadDate`.
        *   This new object is prepended to the existing array of files in localStorage and the state is updated.
        *   Activity is logged via `useActivityLogger`.
    *   **Adding Multiple Files (`handleAddMultipleFiles` via `onMultipleFilesSubmit` prop):**
        *   The `useKnowledgeBase` hook's `addFilesBatch` function is called.
        *   For each uploaded `File` object from the form:
            *   A `KnowledgeFile` object is created with `isTextEntry: false`, `name` (file name), `type` (file MIME type), `size` (file size), `product`, `persona`, a generated `id`, and `uploadDate`. `textContent` is typically `undefined` for file uploads in the KB store (as full binary content isn't stored directly in localStorage for performance/size reasons, especially for non-text files).
        *   These new objects are added to the localStorage array and the state is updated.
        *   Activity is logged.
    *   **Deleting Entry (`handleDeleteFile`):**
        *   The `useKnowledgeBase` hook's `deleteFile` function is called with the `fileId`.
        *   The file is filtered out from the localStorage array, and state is updated.
        *   Activity is logged.
    *   **Clearing All Entries (`handleClearAllKnowledgeBase`):**
        *   The `useKnowledgeBase` hook's `setFiles([])` is called (system default entries will be re-added on next load by `useEffect` in `useKnowledgeBase`).
        *   Activity is logged.
    *   **System Default Entries:**
        *   The `useKnowledgeBase` hook has a `useEffect` that checks if the system default entries for "ET Prime" and "TOI Plus" (with comprehensive product details) exist or need updating. If not, it adds/updates them. This ensures a baseline KB is always present. These entries are `KnowledgeFile` objects with `isTextEntry: true` and predefined `textContent`.

3.  **How Other Modules Use KB Content:**
    *   When an AI feature (e.g., Pitch Generator, Rebuttal Assistant) needs context:
        *   Its page component (e.g., `pitch-generator/page.tsx`) uses the `useKnowledgeBase` hook to get the current list of `KnowledgeFile` entries.
        *   It then filters these entries based on the relevant `product` (and sometimes `persona`).
        *   It constructs a `knowledgeBaseContext` string by:
            *   Concatenating the `name`, `type`, `product`, `persona`, and importantly, the `textContent` (if `isTextEntry` is true and `textContent` exists) of relevant KB entries.
            *   For file entries (`isTextEntry: false`), it includes metadata like name and type, with a note that the AI should use this metadata for context if the full content isn't directly viewable in the string.
            *   This combined string is passed to the Genkit AI flow.

**5.4. Data Structures:**
*   `KnowledgeFile` (defined in `types/index.ts`): Represents a single entry in the KB. Fields include `id`, `name`, `type`, `size`, `product`, `persona`, `uploadDate`, `textContent`, `isTextEntry`.
*   `KnowledgeBaseFormValues` (defined in `knowledge-base-form.tsx`): Client-side form data.

**5.5. Error Handling:**
*   Client-side form validation.
*   Toasts for user feedback on actions (add, delete, export).

---

## Module 6: Training Material Creator

**6.1. Purpose & Overview:**
Generates structured content outlines for training decks or brochures. It can use selected Knowledge Base items, directly uploaded files, or a direct user prompt as the source of context. It targets specific products (ET/TOI) and output formats (PDF, Word, PPT, Brochure). It includes special, predefined frameworks for "ET Prime Sales Training" and "Telesales Data Analysis."

**6.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/create-training-deck/page.tsx` (handles form logic and displays results).
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `src/ai/flows/training-deck-generator.ts` (exports `generateTrainingDeck` function)
*   **AI Model:** `googleai/gemini-2.0-flash` (or similar)

**6.3. Feature Creation Procedure & Data Flow:**

1.  **User Input (UI - `create-training-deck/page.tsx`):**
    *   User selects: Product (ET/TOI), intended Deck Format (PDF, Word Doc, PPT, Brochure).
    *   User provides context via **one** of three methods (UI logic ensures only one source is active):
        1.  **Direct Prompt:** User writes a textual prompt describing the desired training material (min 10 chars).
        2.  **Directly Upload File(s):** User uploads one or more files (PDF, DOCX, TXT, etc.). Max total upload size is 10MB.
        3.  **Select Files from Knowledge Base:** User selects one or more existing items from their Knowledge Base.
    *   User can also choose to "Generate from Entire KB for [Product]".

2.  **Frontend Logic (`create-training-deck/page.tsx` - `handleGenerateMaterial`):**
    *   Validates that product and format are selected, and at least one context source is chosen (or "Entire KB" option).
    *   **Context Preparation (`itemsToProcessForFlow`):**
        *   An array of `FlowKnowledgeBaseItemSchema` (from `training-deck-generator.ts`) is prepared based on the chosen context source:
            *   **Direct Prompt:** A single item with `name: "User-Provided Prompt"`, `textContent: directPrompt`, `isTextEntry: true`, `fileType: "text/plain"`.
            *   **Direct Uploads:** `mapDirectUploadsToFlowItems` is called. For each uploaded file, it creates an item with `name`, `fileType`. If the file is text-based and small (<50KB), its `textContent` is read and included.
            *   **Selected KB Items:** `mapKbFilesToFlowItems` is called. For each selected `KnowledgeFile`, it creates an item with `name`, `fileType`. If `isTextEntry` is true, `textContent` is included.
            *   **Entire KB:** All `KnowledgeFile` entries for the selected product are mapped.
        *   `generateFromAllKbFlag` is set if "Entire KB" was chosen.
        *   `sourceDescription` string is created (e.g., "context from selected KB items: intro.docx, features.txt").
    *   A `GenerateTrainingDeckInput` object is constructed with `product`, `deckFormatHint`, the prepared `knowledgeBaseItems`, `generateFromAllKbFlag`, and `sourceDescriptionForAi`. Long `textContent` in items is truncated before sending to AI.

3.  **Genkit Flow Invocation:**
    *   The `generateTrainingDeck(flowInput)` function is called.

4.  **Genkit Flow Execution (`generateTrainingDeckFlow` in `training-deck-generator.ts`):**
    *   **Input:** Receives `GenerateTrainingDeckInput` (validated against `GenerateTrainingDeckInputSchema`).
    *   **Prompt Invocation:** Calls the `generateTrainingMaterialPrompt`.
        *   **`generateTrainingMaterialPrompt` Details:**
            *   **Input Schema:** `GenerateTrainingDeckInputSchema`.
            *   **Output Schema:** `GenerateTrainingDeckOutputSchema` (expects `deckTitle` and an array of `sections`, where each section has `title`, `content`, `notes`).
            *   **Prompt Text (Core Logic):**
                *   Role: "You are a presentation and documentation specialist..."
                *   Task: Generate content for training material, creating `deckTitle` and structured `sections`.
                *   Inputs: `{{{product}}}`, `{{{deckFormatHint}}}`, `{{{sourceDescriptionForAi}}}`, and iterates through `{{{knowledgeBaseItems}}}` displaying their name, type, and textContent (if available).
                *   **Special Frameworks (Conditional Logic in Prompt):**
                    *   **If "ET Prime – Sales Training Deck" is indicated:** The AI is explicitly instructed to use a predefined 3-section framework (Title Slide, What is ET Prime?, Key Benefits) and flesh it out using the provided `Contextual Information`.
                    *   **If "Telesales Data Analysis Framework" is indicated (and not ET Prime Sales):** The AI uses a predefined 9-section framework (Title, Objective, Data Sources, Metrics, Steps, Sample Output, Recommendations, Checklist, Closing) and fleshes it out.
                    *   **General Case:** If neither special framework applies, the AI synthesizes the provided `Contextual Information` into a relevant structure.
                *   **Content Style Guidance:** Instructs AI to adapt content style based on `deckFormatHint` (narrative for PDF/Brochure, bullets for PPT/Word Doc).
                *   Handles sparse context by suggesting placeholders.
            *   **AI Model:** `googleai/gemini-2.0-flash`.
        *   Returns the AI's structured output.
    *   **Error Handling:** Basic validation on AI output structure. Catches general errors.
    *   **Output:** `GenerateTrainingDeckOutput`.

5.  **Response Handling (UI - `create-training-deck/page.tsx`):**
    *   If the result indicates an error, it's displayed.
    *   Otherwise, the `generatedMaterial` state is set.
    *   The UI then renders an Accordion, with each section of the generated material as an expandable item, showing title, content, and notes.
    *   Export (PDF, Text for Word) and Copy to Clipboard functionalities are provided for the generated text.
    *   Activity is logged.

**6.4. Knowledge Base Integration:**
*   The primary source of information if the user selects "Select Files from Knowledge Base" or "Generate from Entire KB".
*   The `knowledgeBaseItems` array passed to the flow contains metadata and (for text entries or small text files) actual content from the KB.
*   The AI is instructed to use this to generate the training material content.

**6.5. Data Structures:**
*   `GenerateTrainingDeckInput`, `GenerateTrainingDeckOutput`, `ContentSectionSchema`, `TrainingDeckFlowKnowledgeBaseItem` (from `training-deck-generator.ts` and `types/index.ts`).

**6.6. Error Handling:**
*   Frontend validation for inputs.
*   Flow includes `try...catch`. Output schema for errors if AI fails.
*   UI uses toasts and displays error messages.

---

## Module 7: AI Data Analyst

**7.1. Purpose & Overview:**
Simulates an expert data analyst. It takes user descriptions of their data files (Excel, CSV, etc.), their likely structure (including potential messiness), and analytical goals, then generates a comprehensive report. It *simulates* data cleaning and interpretation based on the user's textual descriptions and can use small text samples (from CSV/TXT) for direct observations. **It does not directly process or perform calculations on the internal content of large binary files like Excel.**

**7.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Page: `src/app/(main)/data-analysis/page.tsx`
    *   Form: `src/components/features/data-analysis/data-analysis-form.tsx`
    *   Display: `src/components/features/data-analysis/data-analysis-results-card.tsx`
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `src/ai/flows/data-analyzer.ts` (exports `analyzeData` function)
*   **AI Model:** `googleai/gemini-2.0-flash` (or a similar powerful model capable of complex instruction following).

**7.3. Feature Creation Procedure & Data Flow:**

1.  **User Input (UI - `DataAnalysisForm`):**
    *   User "uploads" files by selecting them. Only file names and types are used as context for the AI (not their full binary content, except for an optional small text sample).
    *   User writes a detailed `userAnalysisPrompt` (min 50, max 10000 chars) describing:
        *   The files and their content/structure (e.g., sheet names, column headers, data types, date formats).
        *   Decoding rules for coded fields (e.g., "NR = Not Reachable").
        *   Specific file mappings (e.g., "My file 'sales\_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'").
        *   Specific analytical goals for this run.
        *   Known data messiness.

2.  **Frontend Logic (`data-analysis/page.tsx` - `handleGenerateAnalysis`):**
    *   Form data (`analysisFiles` FileList, `userAnalysisPrompt` string) is validated.
    *   `fileDetails`: An array `{ fileName, fileType }` is created from the `analysisFiles`.
    *   `sampledFileContent`: If the first uploaded file is CSV/TXT, its first ~10,000 characters are read and stored.
    *   A `DataAnalysisInput` object is constructed.

3.  **Genkit Flow Invocation:**
    *   The `analyzeData(flowInput)` function is called.

4.  **Genkit Flow Execution (`dataAnalysisReportFlow` in `data-analyzer.ts`):**
    *   **Input:** Receives `DataAnalysisInput` (validated against `DataAnalysisInputSchema`).
    *   **Input Validation:** Checks if `userAnalysisPrompt` is sufficient. If not, returns an error structure.
    *   **Prompt Invocation:** Calls the `dataAnalysisReportPrompt`.
        *   **`dataAnalysisReportPrompt` Details:**
            *   **Input Schema:** `DataAnalysisInputSchema`.
            *   **Output Schema:** `DataAnalysisReportSchema` (a complex nested object for the report sections: `reportTitle`, `executiveSummary`, `keyMetrics`, `detailedAnalysis` object with sub-sections, `chartsOrTablesSuggestions`, `recommendations`, `directInsightsFromSampleText`, `limitationsAndDisclaimer`).
            *   **Prompt Text (Core Logic):**
                *   Role: "You are an advanced Excel analyst AI, specializing in telesales..."
                *   Primary Data Source: The `{{{userAnalysisPrompt}}}` is CRITICAL. File context (`{{{fileDetails}}}`) and `{{{sampledFileContent}}}` are also provided.
                *   **Simulated Analytical Process (AI is instructed to *act as if* it performs these based on user's text):**
                    1.  **Data Reconstruction (Simulated Cleanup):** Explain in `dataReconstructionAndNormalizationSummary` how it *would* hypothetically clean data based on user's description of messiness.
                    2.  **Table Normalization (Simulated):** Describe how it *would* reconstruct described sheets into clean tables.
                    3.  **Smart Table Recognition:** Explain in `smartTableRecognitionSummary` how it *infers* table purposes (CDR, MIS, etc.) from column names/user prompt.
                    4.  **KPI Calculation (Simulated):** Explain how it *would* calculate KPIs from assumed clean tables (using provided KPI definitions if applicable or user's descriptions).
                    5.  **Insight Generation:** Populate `detailedAnalysis` sections with insights derived from the simulated analysis.
                *   **Output Style:** Sharp, tabular (markdown), insight-driven.
                *   **Disclaimer Mandate:** Must include a disclaimer that AI has NOT directly processed binary files.
                *   **Handling Insufficient Prompt:** If prompt is insufficient, state that, do not ask follow-up questions.
            *   **AI Model:** `googleai/gemini-2.0-flash`.
            *   **Configuration:** `temperature: 0.3` (for more factual analysis).
        *   Returns the AI's structured report.
    *   **Error Handling:** Catches errors, ensures disclaimer is present. Returns a fallback error structure if AI fails.
    *   **Output:** `DataAnalysisReportOutput`.

5.  **Response Handling (UI - `data-analysis/page.tsx` & `DataAnalysisResultsCard`):**
    *   The `analysisResult` state is updated.
    *   `DataAnalysisResultsCard` renders the structured report using Accordions for different sections.
    *   Toasts for success/failure.
    *   Activity logged.

**7.4. Knowledge Base Integration:** Not directly applicable. This module relies entirely on the user's detailed prompt and their description of the data files.

**7.5. Data Structures:**
*   `DataAnalysisInput`, `DataAnalysisReportOutput`, `KeyMetricSchema`, `ChartTableSuggestionSchema` (from `data-analyzer.ts` and `types/index.ts`).
*   `AnalysisReportResultItem` (client-side).

**7.6. Error Handling:**
*   Frontend form validation.
*   Genkit flow validates prompt length and returns structured errors.
*   UI displays errors and uses toasts.

---

## Module 8: Dashboards

(Activity Dashboard, Transcription Dashboard, Call Scoring Dashboard, Training Material Dashboard, Data Analysis Dashboard)

**8.1. Purpose & Overview:**
These modules provide historical views of activities and outputs generated by other AI features. They allow users to review past interactions, transcripts, scores, generated materials, and analysis reports.

**8.2. Tech Stack & Key Components:**
*   **Frontend:**
    *   Pages: e.g., `src/app/(main)/activity-dashboard/page.tsx`, `src/app/(main)/transcription-dashboard/page.tsx`, etc.
    *   Table Components: e.g., `src/components/features/activity-dashboard/activity-table.tsx`, `src/components/features/transcription-dashboard/dashboard-table.tsx`, etc.
    *   Dialogs for viewing detailed items.
    *   Filtering components (for Activity Dashboard).
*   **Data Source:** `useActivityLogger` hook (`src/hooks/use-activity-logger.ts`), which reads from `localStorage`.
*   **AI Orchestration/Model:** Not directly involved in generating new AI content. These modules *display* the results of past AI interactions.

**8.3. Feature Creation Procedure & Data Flow:**

1.  **Activity Logging (Core Mechanism - `useActivityLogger`):**
    *   Whenever an AI feature completes an operation (e.g., pitch generated, call scored), the respective page component calls `logActivity` or `logBatchActivities` from the `useActivityLogger` hook.
    *   An `ActivityLogEntry` object is created, containing:
        *   `id` (unique), `timestamp`.
        *   `module` (e.g., "Pitch Generator", "Call Scoring").
        *   `product` (if applicable).
        *   `agentName` (from `useUserProfile`).
        *   `details`: A flexible field storing a string summary or a JSON object containing key input parameters and the full AI-generated output (or error details) for that specific activity. This `details` object's structure varies by module.
    *   The new entry (or entries) is added to an array in `localStorage` (key: `ACTIVITY_LOG_KEY`). The log is capped at `MAX_ACTIVITIES_TO_STORE` (e.g., 50 entries), with older entries being discarded.

2.  **Dashboard Page Rendering (e.g., `CallScoringDashboardPage`):**
    *   The dashboard page component uses the `useActivityLogger` hook to get the `activities` array.
    *   It then `useMemo` to filter and transform these `ActivityLogEntry` items into a more specific data structure suitable for its table (e.g., `HistoricalScoreItem` for the call scoring dashboard).
        *   This involves checking `activity.module` to get relevant entries.
        *   It then accesses the structured data within `activity.details` (e.g., `(activity.details as any).scoreOutput`).
    *   The data is typically sorted by timestamp (most recent first).
    *   The specialized table component (e.g., `CallScoringDashboardTable`) renders the data.
    *   Each row in the table usually has a "View" button.

3.  **Viewing Details:**
    *   Clicking "View" sets a state variable with the selected historical item and opens a `Dialog`.
    *   The `DialogContent` then renders a detailed view of the selected item, often reusing the primary display component from the original feature page (e.g., `CallScoringResultsCard` for a scored call, `PitchCard` for a pitch), passing the stored `details` (e.g., the `scoreOutput` or `pitchOutput`).
    *   For features like Transcription or Training Materials, the dialog might show the full text content within a `<Textarea>` or structured layout.

4.  **Export Functionality:**
    *   Dashboards provide "Export Options" (CSV, PDF, Text for Word).
    *   `handleExport` function:
        *   Filters the currently displayed data (if filters are applied, like in Activity Dashboard).
        *   Maps the data to a flat structure suitable for CSV or array-of-arrays for PDF/DOC.
        *   Uses helper functions from `src/lib/export.ts` (`exportToCsv`, `exportTableDataToPdf`, `exportTableDataForDoc`) to generate and trigger the download.
        *   Toasts provide feedback.

**8.4. Data Structures:**
*   `ActivityLogEntry` (from `types/index.ts`): The core structure for all logged activities.
*   Module-specific historical item types (e.g., `HistoricalScoreItem`, `HistoricalTranscriptionItem`) defined in their respective dashboard page files, usually extending or utilizing parts of `ActivityLogEntry`.
*   The `details` field of `ActivityLogEntry` holds module-specific output structures (e.g., `ScoreCallOutput`, `GeneratePitchOutput`, `TranscriptionOutput`, etc.).

**8.5. Error Handling:**
*   Primarily concerned with displaying data correctly. Errors in the original AI generation are logged within the `details.error` field of the `ActivityLogEntry` and displayed in the table/dialog.
*   Export functions have `try...catch` and use toasts.

---

This detailed breakdown covers the main functionalities and their technical underpinnings within the AI_TeleSuite application. The consistent use of Genkit for AI task orchestration, Zod for schema validation, and React with ShadCN/UI for the frontend provides a modular and maintainable structure. The Knowledge Base remains a critical component for content-driven AI features.

    