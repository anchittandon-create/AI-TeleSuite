
# AI_TeleSuite: Project Features & Technical Elaboration

This document details the features of the AI_TeleSuite application, focusing on the AI technology integration, creation procedures, tech stack components, and functional flows for each module, excluding the AI Voice Agent features and their specific dashboards.

## Core Technologies Used:

*   **Frontend:** Next.js (v15+) with React (v18+) for UI, ShadCN UI for pre-built components, Tailwind CSS for styling.
*   **AI Orchestration & Backend Logic:** Genkit (v1.x) for defining AI flows, managing prompts, and interacting with AI models. Runs within Next.js server-side environment.
*   **AI Language Model:** Google's Gemini models (e.g., Gemini 1.5 Flash, Gemini 2.0 Flash) accessed via the `@genkit-ai/googleai` plugin for Genkit.
*   **State Management (Client-Side):** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), supplemented by custom hooks for local storage (`useLocalStorage`) for persisting data like the Knowledge Base and Activity Log.
*   **Data Persistence (Client-Side):** Browser Local Storage is used for:
    *   `useKnowledgeBase`: Storing uploaded files and text entries for the Knowledge Base.
    *   `useActivityLogger`: Storing a log of user and AI activities.
*   **File Handling (Client-Side):** Standard browser File API for uploads, `fileToDataUrl` for converting files to data URIs (for AI model input), and utility functions for exporting data (CSV, PDF, Text).

---

## 1. AI Pitch Generator

### Purpose & Overview:
To generate tailored sales pitches based on product selection, target customer cohort, and specific offer details, leveraging a knowledge base for product information.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/pitch-generator/page.tsx`
    *   Form: `/src/components/features/pitch-generator/pitch-form.tsx` (Handles user input for product, cohort, offer, etc.)
    *   Display: `/src/components/features/pitch-generator/pitch-card.tsx` (Displays the generated pitch components)
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/pitch-generator.ts`
    *   Exports: `generatePitch` function, `GeneratePitchInput` type, `GeneratePitchOutput` type.
*   **AI Model:** `googleai/gemini-1.5-flash-latest` (or similar powerful Gemini model configured in the flow)

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   User selects Product (ET/TOI), Customer Cohort.
    *   Optionally inputs ET Plan Configuration, Sales Plan, Offer details, Agent Name, Customer Name.
    *   Optionally uploads a "Direct Context File" (PDF, DOCX, TXT, etc.).
    *   Clicks "Generate Pitch".
2.  **Frontend Logic (`pitch-generator/page.tsx` & `pitch-form.tsx`):**
    *   The `PitchForm` collects all inputs using `react-hook-form` and Zod validation (`FormSchema` in `pitch-form.tsx`).
    *   If a "Direct Context File" is uploaded:
        *   If it's a readable text type (TXT, MD, CSV) and small (e.g., < 100KB), its content is read as a string.
        *   The file's name and MIME type are captured.
    *   `knowledgeBaseContext` is prepared:
        *   If a direct file is provided, a special block is prefixed to the `knowledgeBaseContext`:
            ```
            --- START OF UPLOADED FILE CONTEXT (PRIMARY SOURCE) ---
            File Name: [direct_file_name]
            File Type: [direct_file_type]
            Instruction to AI: [Instructions on how to prioritize this file...]
            --- BEGIN UPLOADED FILE CONTENT --- (if text content was read)
            [direct_file_content]
            --- END UPLOADED FILE CONTENT ---
            --- END OF UPLOADED FILE CONTEXT ---
            ```
        *   The general Knowledge Base content (from `useKnowledgeBase`) for the selected product and cohort is appended after the direct file context (if any).
    *   An object matching `GeneratePitchInput` schema is created.
    *   The `generatePitch` flow function (from `/src/ai/flows/pitch-generator.ts`) is called with this input.
    *   The returned `GeneratePitchOutput` (or error) is displayed using `PitchCard`.
3.  **Genkit Flow Internals (`pitch-generator.ts`):**
    *   **`GeneratePitchInputSchema` (Zod):** Defines expected input structure (product, cohort, knowledgeBaseContext, optional sales plan, offer, agent/user names, ET plan config).
    *   **`GeneratePitchOutputSchema` (Zod):** Defines the expected structured output (pitchTitle, warmIntroduction, personalizedHook, productExplanation, keyBenefitsAndBundles, discountOrDealExplanation, objectionHandlingPreviews, finalCallToAction, fullPitchScript, estimatedDuration, notesForAgent).
    *   **`generatePitchPrompt` (`ai.definePrompt`):**
        *   Takes `GeneratePitchInputSchema` as input, aims for `GeneratePitchOutputSchema`.
        *   **Prompt Logic:**
            *   Sets the AI's role as a telesales assistant.
            *   Receives product, cohort, offer, agent/user names via Handlebars `{{{variable}}}`.
            *   Receives the crucial `{{{knowledgeBaseContext}}}`.
            *   **CRITICAL INSTRUCTION:** The prompt explicitly instructs the AI to:
                *   Treat the `knowledgeBaseContext` as the *sole source* for product features, benefits, and details.
                *   Prioritize the "UPLOADED FILE CONTEXT" block within `knowledgeBaseContext` if present.
                *   If an uploaded file's content couldn't be read client-side, the AI is instructed to *attempt* to process it based on name/type or state it couldn't and use general KB.
                *   Generate each distinct section of the pitch (introduction, hook, product explanation, benefits, etc.) by deriving information *only* from the KB, ensuring each section provides *new and distinct* information and avoids repetition.
                *   If the KB is sparse for a section, state what would go there and refer the agent to the source, rather than inventing content.
                *   Structure the `fullPitchScript` by smoothly integrating all generated components, targeting 450-600 words for the agent's parts, using placeholders.
            *   Model: `googleai/gemini-1.5-flash-latest` (or similar).
            *   Configuration: Temperature set (e.g., `0.4`) for a balance of creativity and consistency. Safety settings are configured to allow for sales-related language.
    *   **`generatePitchFlow` (`ai.defineFlow`):**
        *   Takes `GeneratePitchInput`, returns `Promise<GeneratePitchOutput>`.
        *   Checks if `knowledgeBaseContext` is effectively empty (excluding direct uploads if a direct file was not the primary source). If so, returns a specific error/placeholder output.
        *   Calls `generatePitchPrompt(input)`.
        *   Handles potential errors from the AI call (e.g., API key issues, safety blocks, empty responses) and returns a structured error object.
        *   Validates the output against `GeneratePitchOutputSchema`.
4.  **Knowledge Base Interaction:**
    *   The `prepareGeneralKnowledgeBaseContext` helper function in `pitch-generator/page.tsx` filters files from `useKnowledgeBase` based on the selected `product`.
    *   It concatenates content from relevant text entries and provides metadata for file entries, forming the `knowledgeBaseContext` string.
5.  **Activity Logging (`useActivityLogger`):**
    *   `logActivity` is called with:
        *   `module: "Pitch Generator"`
        *   `product: selectedProduct`
        *   `details: { pitchOutput: result, inputData: { /* key input parameters */ } }`

### Data Structures:
*   `GeneratePitchInput`, `GeneratePitchOutput` (from `src/ai/flows/pitch-generator.ts` and `src/types/index.ts`)
*   `KnowledgeFile` (from `src/types/index.ts`) for KB items.

### Error Handling:
*   Zod schema validation for form inputs.
*   `try...catch` within the `generatePitchFlow` for AI call errors.
*   Client-side `try...catch` when calling the flow function.
*   Error states managed in the UI to display messages via `Alert` components or `toast`.

---

## 2. AI Rebuttal Assistant

### Purpose & Overview:
To provide intelligent, context-aware rebuttals to customer objections during sales calls, based on product information from the Knowledge Base.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/rebuttal-generator/page.tsx`
    *   Form: `/src/components/features/rebuttal-generator/rebuttal-form.tsx`
    *   Display: `/src/components/features/rebuttal-generator/rebuttal-display.tsx`
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/rebuttal-generator.ts`
    *   Exports: `generateRebuttal` function, `GenerateRebuttalInput` type, `GenerateRebuttalOutput` type.
*   **AI Model:** `googleai/gemini-2.0-flash` (or similar)

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   User selects Product (ET/TOI).
    *   User types in the "Customer Objection."
    *   Clicks "Get Rebuttal."
2.  **Frontend Logic (`rebuttal-generator/page.tsx` & `rebuttal-form.tsx`):**
    *   `RebuttalForm` collects product and objection using `react-hook-form` and Zod validation.
    *   `knowledgeBaseContext` is prepared by the `prepareKnowledgeBaseContext` helper function (similar to Pitch Generator, filtering KB entries for the selected product).
    *   An object matching `GenerateRebuttalInput` (objection, product, knowledgeBaseContext) is created.
    *   The `generateRebuttal` flow function is called.
    *   The result (`GenerateRebuttalOutput`) is displayed.
3.  **Genkit Flow Internals (`rebuttal-generator.ts`):**
    *   **`GenerateRebuttalInputSchema` (Zod):** Defines `objection`, `product`, `knowledgeBaseContext`.
    *   **`GenerateRebuttalOutputSchema` (Zod):** Defines `rebuttal` (string).
    *   **`generateRebuttalPrompt` (`ai.definePrompt`):**
        *   **Prompt Logic:**
            *   Sets AI role as a telesales assistant specializing in rebuttals for the given `{{{product}}}`.
            *   Takes `{{{objection}}}` and `{{{knowledgeBaseContext}}}` as input.
            *   **CRITICAL INSTRUCTION:**
                *   Analyze the core of the objection.
                *   Prioritize the `knowledgeBaseContext` to find relevant facts, benefits, or selling themes to counter the specific objection.
                *   Synthesize KB info into a compelling argument (not just list facts).
                *   Structure the rebuttal (Acknowledge, Bridge, Benefit, Question - ABBC/Q).
                *   If KB is sparse for the specific objection, acknowledge, pivot to a general strength from KB (if any), and ask clarifying questions.
                *   Strictly adhere to KB for product facts; do not invent.
                *   Maintain a confident, helpful, professional tone.
            *   Model: `googleai/gemini-2.0-flash`.
            *   Configuration: Temperature set (e.g., `0.4`).
    *   **`generateRebuttalFlow` (`ai.defineFlow`):**
        *   Checks if `knowledgeBaseContext` is effectively empty. If so, returns a "Cannot generate..." message.
        *   Calls `generateRebuttalPrompt(input)`.
        *   Handles errors and empty/short responses from the AI.
4.  **Knowledge Base Interaction:**
    *   `prepareKnowledgeBaseContext` function in `rebuttal-generator/page.tsx` filters `useKnowledgeBase` files for the selected product.
5.  **Activity Logging (`useActivityLogger`):**
    *   `logActivity` with `module: "Rebuttal Generator"`, `product`, and details including the input and output.

### Data Structures:
*   `GenerateRebuttalInput`, `GenerateRebuttalOutput` (from flow and `src/types/index.ts`).
*   `KnowledgeFile`.

### Error Handling:
*   Zod schema validation for form inputs.
*   `try...catch` in the flow, UI toasts for errors.

---

## 3. Audio Transcription

### Purpose & Overview:
To transcribe uploaded audio files into text, providing speaker diarization (identifying different speakers like Agent, User, Ringing) and a qualitative accuracy assessment.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/transcription/page.tsx`
    *   UI for file upload, displaying results (single card or table for multiple files).
    *   Components: `/src/components/features/transcription/transcription-results-table.tsx`
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/transcription-flow.ts`
    *   Exports: `transcribeAudio` function, `TranscriptionInput` type, `TranscriptionOutput` type.
*   **AI Model:** `googleai/gemini-2.0-flash` (or a model with audio processing capabilities if available through the plugin, typically models supporting multimodal input).

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   User selects one or more audio files (MP3, WAV, M4A, etc.) via an `<input type="file">`.
    *   Clicks "Transcribe Audio."
2.  **Frontend Logic (`transcription/page.tsx`):**
    *   Validates file type and size (client-side).
    *   For each file:
        *   Converts the `File` object to a base64 encoded Data URI using `fileToDataUrl` utility.
        *   Creates a `TranscriptionInput` object: `{ audioDataUri: "data:audio/wav;base64,..." }`.
        *   Calls the `transcribeAudio` flow function.
        *   Collects results (or errors) for each file.
        *   Displays results in a single card (for one file) or a table (`TranscriptionResultsTable`) for multiple files.
3.  **Genkit Flow Internals (`transcription-flow.ts`):**
    *   **`TranscriptionInputSchema` (Zod):** Defines `audioDataUri` (string, expecting data URI format).
    *   **`TranscriptionOutputSchema` (Zod):** Defines `diarizedTranscript` (string with specific formatting rules for time allotments and speaker labels) and `accuracyAssessment` (string: "High", "Medium", "Low", with reasons).
    *   **`transcribeAudioPrompt` (`ai.definePrompt`):**
        *   Input: `audioDataUri` via `{{media url=audioDataUri}}` Handlebars syntax, which tells Genkit to pass the audio data to the model.
        *   **Prompt Logic (Critical Instructions):**
            *   **Time Allotment & Dialogue Structure:** Instructs AI to segment audio, provide time allotments (e.g., "[0 seconds - 15 seconds]"), and then the speaker label and text on the next line.
            *   **Diarization & Speaker Labels (ALL CAPS):** Strict rules for labeling "RINGING:", "AGENT:", "USER:", or "SPEAKER 1:/2:" if roles are ambiguous. Prioritizes AGENT/USER identification based on conversational cues.
            *   **Non-Speech Sounds:** Label sounds like (Background Noise), (Silence) within the text.
            *   **Language & Script (STRICT):** Entire transcript MUST be English (Roman script). Hindi/Hinglish words *must* be transliterated into Roman script (e.g., "kya" not "क्या"). No Devanagari characters.
            *   **Accuracy Assessment:** AI must self-assess transcription accuracy (High, Medium, Low) based on audio clarity and explain its reasoning.
            *   **Completeness:** Transcript must be complete.
        *   Model: `googleai/gemini-2.0-flash` (or another model that supports audio input and transcription, this model name is a placeholder as Gemini's audio capabilities evolve in Genkit).
        *   Configuration: `temperature: 0.1` for factual transcription.
    *   **`transcriptionFlow` (`ai.defineFlow`):**
        *   Calls `transcribeAudioPrompt(input)`.
        *   Handles errors from the AI (e.g., unsupported audio, API issues, safety blocks) and returns structured error messages in the `diarizedTranscript` and "Error" `accuracyAssessment`.
        *   Validates the AI output for basic structure (presence of transcript).
4.  **Knowledge Base Interaction:** None for this module directly, but transcripts can be *added* to the KB.
5.  **Activity Logging (`useActivityLogger`):**
    *   `logBatchActivities` is called with an array of entries, one per file:
        *   `module: "Transcription"`
        *   `details: { fileName, transcriptionOutput: result, error: (if any) }`

### Data Structures:
*   `TranscriptionInput`, `TranscriptionOutput` (from flow and `src/types/index.ts`).

### Error Handling:
*   Client-side file validation.
*   `try...catch` in the flow for AI errors, returning error messages within the `TranscriptionOutput` structure.
*   UI displays errors per file in the results table or card.

---

## 4. AI Call Scoring

### Purpose & Overview:
To analyze call transcripts (derived from uploaded audio) for various sales performance metrics, providing an overall score, categorization, and specific feedback.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/call-scoring/page.tsx`
    *   Form: `/src/components/features/call-scoring/call-scoring-form.tsx`
    *   Display: `/src/components/features/call-scoring/call-scoring-results-card.tsx` (single result), `/src/components/features/call-scoring/call-scoring-results-table.tsx` (multiple results).
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/call-scoring.ts`
    *   Depends on `/src/ai/flows/transcription-flow.ts` internally.
    *   Exports: `scoreCall` function, `ScoreCallInput` type, `ScoreCallOutput` type.
*   **AI Models:**
    *   Transcription part: Same as Transcription module (e.g., `googleai/gemini-2.0-flash` or audio-capable model).
    *   Scoring part: `googleai/gemini-2.0-flash` (or similar text analysis model).

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   User selects Product Focus (ET/TOI).
    *   Uploads one or more audio files.
    *   Optionally enters Agent Name.
    *   Clicks "Score Call(s)."
2.  **Frontend Logic (`call-scoring/page.tsx`):**
    *   Collects inputs via `CallScoringForm`.
    *   For each audio file:
        *   Converts `File` to data URI (`audioDataUri`).
        *   Creates `ScoreCallInput` object: `{ audioDataUri, product, agentName }`.
        *   Calls `scoreCall` flow function.
        *   Collects results/errors.
        *   Displays using `CallScoringResultsCard` or `CallScoringResultsTable`.
3.  **Genkit Flow Internals (`call-scoring.ts`):**
    *   **`ScoreCallInputSchema` (Zod):** `audioDataUri`, `product`, `agentName` (optional).
    *   **`ScoreCallOutputSchema` (Zod):** `transcript`, `transcriptAccuracy`, `overallScore`, `callCategorisation`, `metricScores` (array of metric, score, feedback), `summary`, `strengths`, `areasForImprovement`.
    *   **`scoreCallFlow` (`ai.defineFlow`):**
        *   **Step 1: Transcription (Internal Call)**
            *   Calls `transcribeAudio({ audioDataUri: input.audioDataUri })` from `transcription-flow.ts`.
            *   **CRITICAL:** Handles errors from the transcription step. If transcription fails (e.g., audio issue, API error), the flow returns an error structure within `ScoreCallOutput` *without proceeding to scoring*. This includes setting `transcript` to the error message from transcription, `transcriptAccuracy` to "Error", `overallScore` to 0, and providing specific feedback about the transcription failure in `metricScores` and `summary`.
        *   **Step 2: Scoring (If Transcription Succeeded)**
            *   Prepares `ScoreCallPromptInputSchema` with the `transcript` from Step 1 and the original `product` and `agentName`.
            *   Calls `scoreCallPrompt(promptInput)`.
            *   If `scoreCallPrompt` returns no output or errors, it populates `ScoreCallOutput` with appropriate error messages for the scoring part, but *keeps the successful transcript*.
            *   Combines the scoring output with the transcript details to form the final `ScoreCallOutput`.
    *   **`scoreCallPrompt` (`ai.definePrompt`):**
        *   Input: `ScoreCallPromptInputSchema` (transcript, product, agentName).
        *   Output: `ScoreCallPromptOutputSchema` (omits transcript fields).
        *   **Prompt Logic:**
            *   Role: Expert call quality analyst.
            *   Analyzes the provided `{{{transcript}}}` for a call about `{{{product}}}`.
            *   Evaluates against metrics: Opening, Needs Discovery, Product Presentation (relevance to `{{{product}}}`), Objection Handling, Closing, Clarity, Agent's Tone, User's Perceived Sentiment, Product Knowledge (specific to `{{{product}}}`).
            *   Instructs AI to provide overall score (1-5), categorization (Very Good, etc.), detailed feedback for each metric (referencing transcript), summary, strengths, and improvement areas.
            *   Emphasizes objectivity.
        *   Model: `googleai/gemini-2.0-flash`.
        *   Configuration: `temperature: 0.2` (for deterministic scoring).
4.  **Knowledge Base Interaction:** None directly for scoring itself, but "Product Knowledge" is a scoring metric, implicitly testing against expected product details (which would ideally be in the KB if the agent learned from it).
5.  **Activity Logging (`useActivityLogger`):**
    *   `logBatchActivities` is called:
        *   One entry for "Call Scoring": `module: "Call Scoring"`, `product`, `details: { fileName, scoreOutput, agentNameFromForm, error }`.
        *   If transcription occurred, another entry: `module: "Transcription"`, `product`, `details: { fileName, transcriptionOutput: { diarizedTranscript: scoreOutput.transcript, accuracyAssessment: scoreOutput.transcriptAccuracy }, error: (if transcript error) }`.

### Data Structures:
*   `ScoreCallInput`, `ScoreCallOutput` (from flow and `src/types/index.ts`).
*   `TranscriptionOutput` (internally used and logged).

### Error Handling:
*   Robust error handling within `scoreCallFlow` for both transcription and scoring phases, ensuring partial results (like a successful transcript even if scoring fails) or specific error messages are returned.
*   UI displays per-file errors or overall errors.

---

## 5. Knowledge Base Management

### Purpose & Overview:
To allow admin users to upload, manage, and view documents and text entries that serve as the contextual knowledge source for AI features like Pitch Generation and Rebuttal Assistance.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/knowledge-base/page.tsx`
    *   Form: `/src/components/features/knowledge-base/knowledge-base-form.tsx` (for adding files/text)
    *   Table: `/src/components/features/knowledge-base/knowledge-base-table.tsx` (for displaying and managing entries)
*   **AI Orchestration:** N/A (This module is primarily for data management to *feed* AI features).
*   **Genkit Flow:** N/A.
*   **AI Model:** N/A.
*   **Client-Side Storage:** `useKnowledgeBase` hook using browser Local Storage.

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   **Adding Entries:**
        *   User selects "Upload File(s)" or "Add Text/Prompt."
        *   Optionally selects associated Product and Persona/Cohort.
        *   If "Upload File(s)": Selects one or more files (PDF, DOCX, TXT, CSV, audio, PPTX, XLSX etc.).
        *   If "Add Text/Prompt": Enters a Name/Title and the Text Content.
        *   Clicks "Upload File(s)" or "Add Text Entry."
    *   **Viewing/Managing Entries:**
        *   `KnowledgeBaseTable` displays all entries with details (name, type, size, product, persona, upload date).
        *   User can "View" (shows details in a dialog, including text content for text entries) or "Delete" entries.
    *   **Export/Clear:**
        *   User can "Export KB Log as CSV."
        *   User can "Clear All KB Entries" (with confirmation).
        *   User can "Download Full AI Prompts & Logic" (a static text file embedded in the component).
2.  **Frontend Logic (`knowledge-base/page.tsx`, `knowledge-base-form.tsx`, `knowledge-base-table.tsx`):**
    *   **`KnowledgeBaseForm`:**
        *   Uses `react-hook-form` and Zod for validation.
        *   Handles file selection or text input.
        *   On submit, calls `onSingleEntrySubmit` or `onMultipleFilesSubmit` props passed from the page.
    *   **`knowledge-base/page.tsx`:**
        *   Uses `useKnowledgeBase` hook (`addFile`, `addFilesBatch`, `deleteFile`, `setFiles` functions).
        *   `handleAddSingleEntry`: Creates a `KnowledgeFile` object and calls `addFile` from the hook.
        *   `handleAddMultipleFiles`: Iterates through uploaded files, creates `KnowledgeFile` objects, and calls `addFilesBatch`.
        *   `handleDeleteFile`: Calls `deleteFile` from the hook.
        *   `handleExportCsv`: Formats `files` from `useKnowledgeBase` and uses `exportToCsv` utility.
        *   `handleClearAllKnowledgeBase`: Calls `setFiles([])`.
    *   **`KnowledgeBaseTable`:** Displays `files` from `useKnowledgeBase`.
    *   **Default System Entries:** The `useKnowledgeBase` hook includes logic in an `useEffect` to ensure that two system default text entries (one for ET Prime, one for TOI Plus, containing comprehensive product details) are always present in the Knowledge Base. If they are missing or their content differs from the hardcoded master content, they are re-added/updated, preserving user-added files.
3.  **Knowledge Base Interaction (Directly via `useKnowledgeBase` hook):**
    *   All operations (add, delete, list) interact directly with the local storage via the `useKnowledgeBase` hook.
4.  **Activity Logging (`useActivityLogger`):**
    *   `logActivity` is called for actions like:
        *   Add single/batch: `module: "Knowledge Base Management"`, `details: { action: 'add'/'add_batch', fileData/filesData }`.
        *   Delete: `details: { action: 'delete', fileId, name }`.
        *   Clear All: `details: { action: 'clear_all', countCleared }`.
        *   Download Prompts: `details: { action: 'download_full_prompts' }`.

### Data Structures:
*   `KnowledgeFile` (from `src/types/index.ts`): `id`, `name`, `type`, `size`, `product?`, `persona?`, `uploadDate`, `textContent?`, `isTextEntry?`.

### Error Handling:
*   Form validation for inputs.
*   Toasts for success/error messages.
*   Confirmation dialog for "Clear All."

---

## 6. Training Material Creator

### Purpose & Overview:
To generate structured content outlines for training materials (decks, brochures) based on a selected product, target format, and contextual information derived from the Knowledge Base, direct file uploads, or a user-provided prompt.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/create-training-deck/page.tsx`
    *   UI for selecting product, format, context source (direct prompt, direct uploads, selected KB items, or entire KB for product).
    *   Display of generated material in an Accordion format.
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/training-deck-generator.ts`
    *   Exports: `generateTrainingDeck` function, `GenerateTrainingDeckInput` type, `GenerateTrainingDeckOutput` type.
*   **AI Model:** `googleai/gemini-2.0-flash` (or similar)

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   Selects Product (ET/TOI) and Output Format (PDF, Word Doc, PPT, Brochure).
    *   Chooses **one** context source:
        *   Enters a "Direct Prompt" (detailed description of desired material).
        *   "Directly Uploads File(s)" (PDF, DOCX, TXT, etc., to provide context).
        *   "Selects Files from Knowledge Base."
    *   Clicks "Generate from Provided Context" or "Generate from Entire KB for {Product}."
2.  **Frontend Logic (`create-training-deck/page.tsx`):**
    *   Manages state for selections and uploaded files.
    *   **Context Preparation:**
        *   If "Direct Prompt": The prompt text is used as the primary `knowledgeBaseItem`.
        *   If "Direct Uploads": Uploaded `File` objects are mapped to `FlowKnowledgeBaseItemSchema` (reading text content for small text files, otherwise just name/type).
        *   If "Selected KB": Chosen `KnowledgeFile` items are mapped to `FlowKnowledgeBaseItemSchema`.
        *   If "Entire KB": All `KnowledgeFile` items for the selected product are mapped.
    *   `sourceDescriptionForAi` string is created (e.g., "context from direct user prompt," "context from 2 uploaded files: report.docx, notes.txt").
    *   `GenerateTrainingDeckInput` object is assembled.
    *   Calls `generateTrainingDeck` flow function.
    *   Displays the `GenerateTrainingDeckOutput` (title and sections) in an Accordion.
    *   Provides options to "Copy" or "Download" (as PDF or Text for Word/PPT) the generated content.
3.  **Genkit Flow Internals (`training-deck-generator.ts`):**
    *   **`GenerateTrainingDeckInputSchema` (Zod):** `product`, `deckFormatHint`, `knowledgeBaseItems` (array of `KnowledgeBaseItemSchemaInternal`), `generateFromAllKb` (boolean), `sourceDescriptionForAi`.
        *   `KnowledgeBaseItemSchemaInternal`: `name`, `textContent?`, `isTextEntry`, `fileType?`.
    *   **`GenerateTrainingDeckOutputSchema` (Zod):** `deckTitle`, `sections` (array of `ContentSectionSchema` with `title`, `content`, `notes?`).
    *   **`generateTrainingMaterialPrompt` (`ai.definePrompt`):**
        *   **Prompt Logic:**
            *   Role: Presentation/documentation specialist for `{{{product}}}`.
            *   Inputs: `{{{product}}}`, `{{{deckFormatHint}}}`, `{{{sourceDescriptionForAi}}}`, and iterated `{{{knowledgeBaseItems}}}` (displaying name, type, and textContent excerpt if available).
            *   **Special Case Frameworks:**
                *   If inputs indicate "ET Prime – Sales Training Deck," use a predefined 3-slide framework (Title, What is ET Prime?, Key Benefits), fleshing out details from provided context.
                *   If inputs indicate "Telesales Data Analysis Framework," use a predefined 9-section framework (Title, Objective, Data Sources, Metrics, Steps, Sample Output, Recommendations, Checklist, Closing), adapting for `{{{product}}}`.
            *   **General Case:** If no special case, synthesize provided context into a logical structure.
            *   **Content Style Guidance:** Adapts content style (narrative/paragraph for PDF/Brochure, concise/bullets for Word/PPT) based on `{{{deckFormatHint}}}`. Includes textual suggestions for visuals for Brochures/PDFs.
            *   Instructs AI to create `deckTitle` and at least 3 `sections`.
            *   Handles sparse context by stating it and providing placeholder structure.
        *   Model: `googleai/gemini-2.0-flash`.
    *   **`generateTrainingDeckFlow` (`ai.defineFlow`):**
        *   Calls `generateTrainingMaterialPrompt(input)`.
        *   Basic validation on the output structure.
        *   Handles errors.
4.  **Knowledge Base Interaction:** Context can be sourced from selected items in the `useKnowledgeBase` store or the entire KB for a product.
5.  **Activity Logging (`useActivityLogger`):**
    *   `logActivity` with `module: "Create Training Material"`, `product`, and `details: { materialOutput: result, inputData: flowInput, error: (if any) }`.

### Data Structures:
*   `GenerateTrainingDeckInput`, `GenerateTrainingDeckOutput`, `KnowledgeBaseItemSchemaInternal` (from flow and `src/types/index.ts`).
*   `KnowledgeFile`.

### Error Handling:
*   Form validation for product/format. Input validation for context (e.g., at least one source).
*   Error handling in the flow for AI failures.
*   UI toasts and error display.

---

## 7. AI Data Analyst

### Purpose & Overview:
To provide AI-powered analysis of user-described data files (Excel, CSV, etc.). The AI simulates data cleaning, interpretation, and analysis based on a detailed user prompt and file metadata, outputting a structured report. It does *not* directly process the binary content of large complex files.

### Tech Stack & Key Components:
*   **Frontend:**
    *   Page: `/src/app/(main)/data-analysis/page.tsx`
    *   Form: `/src/components/features/data-analysis/data-analysis-form.tsx`
    *   Display: `/src/components/features/data-analysis/data-analysis-results-card.tsx`
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/data-analyzer.ts`
    *   Exports: `analyzeData` function, `DataAnalysisInput` type, `DataAnalysisReportOutput` type.
*   **AI Model:** `googleai/gemini-2.0-flash` (or a more powerful version due to complexity).

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   User "uploads" one or more files (Excel, CSV, TXT, PDF, etc.) to provide their names and types as context.
    *   User writes a **detailed analysis prompt** (min 50 chars) describing:
        *   The files (e.g., "Monthly MIS in Excel with sheets for Oct-May...").
        *   Their likely data structure (columns, date formats, decoding rules for coded fields like 'NR' = Not Reachable).
        *   Specific file mappings (e.g., "'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'").
        *   Analytical goals for the current run (e.g., "Focus on Q4 & Q1 trends...").
        *   Known data messiness.
    *   Clicks "Generate Analysis Report."
2.  **Frontend Logic (`data-analysis/page.tsx` & `data-analysis-form.tsx`):**
    *   `DataAnalysisForm` collects files and the detailed prompt.
    *   `fileDetails` array (name, type) is created from uploaded files.
    *   If the first uploaded file is CSV/TXT, a small sample of its content (`sampledFileContent`) is read (first ~10k chars).
    *   `DataAnalysisInput` object is assembled.
    *   Calls `analyzeData` flow function.
    *   Displays `DataAnalysisReportOutput` using `DataAnalysisResultsCard`.
3.  **Genkit Flow Internals (`data-analyzer.ts`):**
    *   **`DataAnalysisInputSchema` (Zod):** `fileDetails` (array of file name/type), `userAnalysisPrompt` (string), `sampledFileContent?` (string).
    *   **`DataAnalysisReportSchema` (Zod):** Highly structured output including `reportTitle`, `executiveSummary`, `keyMetrics` (array), `detailedAnalysis` (object with sub-sections like `dataReconstructionAndNormalizationSummary`, `smartTableRecognitionSummary`, `timeSeriesTrends`, `comparativePerformance`, `useCaseSpecificInsights`), `chartsOrTablesSuggestions?`, `recommendations` (array), `directInsightsFromSampleText?`, and a crucial `limitationsAndDisclaimer`.
    *   **`dataAnalysisReportPrompt` (`ai.definePrompt`):**
        *   **Prompt Logic (Very Detailed):**
            *   Role: Advanced Excel analyst AI specializing in telesales.
            *   Inputs: `{{{fileDetails}}}`, `{{{userAnalysisPrompt}}}`, `{{{sampledFileContent}}}`.
            *   **CRITICAL INSTRUCTION:** The AI is told to perform its analysis *based solely on the user's textual descriptions and the file metadata/sample*. It does *not* see the content of binary files.
            *   **Simulated Analytical Process:** The prompt guides the AI to *act as if* it has performed:
                1.  Data Reconstruction (Simulated Cleanup): Based on user's description of messiness.
                2.  Table Normalization (Simulated): Reconstructing described sheets into clean tables.
                3.  Smart Table Recognition: Inferring table purposes (CDR, MIS, etc.) from user's descriptions.
                4.  KPI Calculation: Based on described fields and assumed clean data (providing formulas like Conversion Rate, Avg Revenue/Call).
                5.  Insight Generation: Populating detailed analysis sections.
            *   **Output Structure:** Strict adherence to `DataAnalysisReportSchema`.
            *   **Emphasis:** Interpret, don't just describe. Be specific where user's text allows. Provide actionable recommendations. Include the mandatory disclaimer about not processing full binary files.
            *   If user prompt is insufficient for a section, state that clearly.
        *   Model: `googleai/gemini-2.0-flash` (or higher tier for complexity).
        *   Configuration: `temperature: 0.3` for factual analysis.
    *   **`dataAnalysisReportFlow` (`ai.defineFlow`):**
        *   Validates `userAnalysisPrompt` length.
        *   Calls `dataAnalysisReportPrompt(input)`.
        *   Ensures the `limitationsAndDisclaimer` is always present in the output.
        *   Handles errors and returns a fallback error structure.
4.  **Knowledge Base Interaction:** N/A.
5.  **Activity Logging (`useActivityLogger`):**
    *   `logActivity` with `module: "Data Analysis"`, `details: { inputData: flowInput, analysisOutput: result, error: (if any) }`.

### Data Structures:
*   `DataAnalysisInput`, `DataAnalysisReportOutput`, `KeyMetricSchema`, `ChartTableSuggestionSchema` (from flow and `src/types/index.ts`).

### Error Handling:
*   Client-side validation for prompt length.
*   Flow handles insufficient prompt or AI errors, returning structured error reports.
*   UI displays errors or the full report.

---

## 8. Dashboards (Activity, Transcription, Call Scoring, Training Material, Data Analysis)

### Purpose & Overview:
To provide users with a historical view of activities performed and AI-generated outputs from various modules.

### Tech Stack & Key Components:
*   **Frontend (Example: Activity Dashboard - others follow similar pattern):**
    *   Page: `/src/app/(main)/activity-dashboard/page.tsx`
    *   Table: `/src/components/features/activity-dashboard/activity-table.tsx`
    *   Filters: `/src/components/features/activity-dashboard/filters.tsx`
    *   (Similar components exist for Transcription, Call Scoring, Training Material, and Data Analysis dashboards)
*   **AI Orchestration:** N/A (Dashboards display logged data).
*   **Genkit Flow:** N/A.
*   **AI Model:** N/A.
*   **Client-Side Storage:** `useActivityLogger` hook using browser Local Storage to retrieve logged activities.

### Feature Creation Procedure & Data Flow:
1.  **User Interaction (UI):**
    *   User navigates to a specific dashboard page (e.g., Activity Dashboard).
    *   **Activity Dashboard:** Can filter by date range, agent name, module, product.
    *   All dashboards allow viewing details of individual logged items in a dialog.
    *   Export options (CSV, PDF, Text for Word) are available for the table data.
2.  **Frontend Logic (Page Components like `activity-dashboard/page.tsx`):**
    *   Uses `useActivityLogger` to get the `activities` array from local storage.
    *   `useEffect` to set `isClient` to `true` to avoid hydration mismatches with local storage dependent data.
    *   **Filtering (Activity Dashboard):** `useMemo` recalculates `filteredActivities` based on selected filter values.
    *   **Data Transformation (Specific Dashboards):**
        *   `call-scoring-dashboard/page.tsx`: Filters activities for `module: "Call Scoring"` and extracts `HistoricalScoreItem` data.
        *   `transcription-dashboard/page.tsx`: Filters for `module: "Transcription"` and extracts `HistoricalTranscriptionItem`.
        *   `training-material-dashboard/page.tsx`: Filters for `module: "Create Training Material"` and extracts `HistoricalMaterialItem`.
        *   `data-analysis-dashboard/page.tsx`: Filters for `module: "Data Analysis"` and extracts `HistoricalAnalysisReportItem`.
    *   **Sorting & Display:** Table components (`ActivityTable`, `CallScoringDashboardTable`, etc.) handle display and client-side sorting of the relevant historical items.
    *   **View Details:** Opens a `Dialog` component, passing the selected activity/item. The dialog content dynamically renders the details based on the module (e.g., using `CallScoringResultsCard`, `PitchCard`, or formatted text for others).
    *   **Export Logic:**
        *   Maps the currently displayed (and filtered, if applicable) data to a simpler format for export.
        *   Uses utility functions (`exportToCsv`, `exportTableDataToPdf`, `exportTableDataForDoc`) from `/src/lib/export.ts`.
3.  **Knowledge Base Interaction:** N/A.
4.  **Activity Logging (`useActivityLogger`):** These modules primarily consume data logged by other features.

### Data Structures:
*   `ActivityLogEntry` (base type from `src/types/index.ts`).
*   Specific historical item types like `HistoricalScoreItem`, `HistoricalTranscriptionItem`, `HistoricalMaterialItem`, `HistoricalAnalysisReportItem` (derived from `ActivityLogEntry` with specific `details` structures).

### Error Handling:
*   Graceful handling if local storage data is missing or malformed (though `useLocalStorage` attempts to initialize).
*   Error messages for export failures via `toast`.

This detailed breakdown should provide a clearer picture of how each module is architected and operates within the AI_TeleSuite application.

    