
# **AI_TeleSuite: Project Features & Technical Elaboration**

This document provides a detailed technical elaboration of the AI_TeleSuite application, focusing on its core features, AI technology integration, user interaction flows, backend logic, and data management. It excludes the "AI Voice Sales Agent" and "AI Voice Support Agent" modules and their specific dashboards.

## **Core Technologies Used:**

*   **Frontend Framework:** Next.js (v15+) with React (v18+) for building a server-rendered, performant user interface.
*   **UI Components:** ShadCN UI, a collection of accessible and customizable React components.
*   **Styling:** Tailwind CSS for utility-first styling, configured via `src/app/globals.css` for theme variables (primary, accent, background colors).
*   **AI Orchestration & Backend Logic:** Genkit (v1.x), a framework for building AI-powered applications. It's used for defining AI flows, managing prompts, interacting with AI models, and structuring inputs/outputs. Genkit flows run within the Next.js server-side environment.
*   **AI Language Model:** Google's Gemini models (e.g., `gemini-1.5-flash-latest`, `gemini-2.0-flash`) accessed via the `@genkit-ai/googleai` plugin for Genkit. The specific model is typically defined within each Genkit flow.
*   **Client-Side State Management:** Primarily React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). Custom hooks like `useLocalStorage` are employed for persisting data in the browser's Local Storage.
*   **Client-Side Data Persistence:**
    *   `useKnowledgeBase` (`/src/hooks/use-knowledge-base.ts`): Manages the Knowledge Base entries (uploaded files, text prompts) using Local Storage via the `KNOWLEDGE_BASE_KEY`.
    *   `useActivityLogger` (`/src/hooks/use-activity-logger.ts`): Manages a log of user and AI activities using Local Storage via the `ACTIVITY_LOG_KEY`. Limited to `MAX_ACTIVITIES_TO_STORE` entries.
    *   `useUserProfile` (`/src/hooks/useUserProfile.ts`): Provides the current user profile (fixed to "Anchit" in this version for simplicity, previously used Local Storage).
*   **Client-Side File Handling:** Standard browser File API for uploads. Utility functions like `fileToDataUrl` (`/src/lib/file-utils.ts`) convert `File` objects to base64 Data URIs for AI model input or local display. Utility functions in `/src/lib/export.ts` (e.g., `exportToCsv`, `exportPlainTextFile`, `exportTableDataToPdf`) and `/src/lib/pdf-utils.ts` (`exportTextContentToPdf`) handle data export.
*   **Forms & Validation:** `react-hook-form` for form state management and `zod` for schema definition and validation on both client and server/flow sides.

---

## **1. AI Pitch Generator**

### **Purpose & Overview:**
To empower sales agents by automatically generating tailored sales pitches. The AI synthesizes product information from the Knowledge Base (and optionally a directly uploaded context file) with user-defined parameters (product, customer cohort, offer details) to craft a comprehensive pitch script.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/pitch-generator/page.tsx`
    *   Orchestrates the UI, manages state for pitch generation, and handles the call to the AI flow.
*   **Frontend Form Component:** `/src/components/features/pitch-generator/pitch-form.tsx`
    *   Uses `react-hook-form` and `zod` (`FormSchema`) for input collection and validation.
    *   Handles direct file upload for contextual information.
*   **Frontend Display Component:** `/src/components/features/pitch-generator/pitch-card.tsx`
    *   Displays the structured output from the AI, including the full pitch script and individual components, in an accordion format.
    *   Provides "Copy" and "Download" (PDF, Text) functionality.
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/pitch-generator.ts`
    *   Exports: `generatePitch` (async function), `GeneratePitchInput` (Zod schema type), `GeneratePitchOutput` (Zod schema type).
*   **AI Model:** `googleai/gemini-1.5-flash-latest` (or as configured in the flow).

### **User Input Fields & Options (`pitch-form.tsx`):**

1.  **Product:** (Required)
    *   UI Element: `Select` component.
    *   Options: "ET", "TOI" (from `PRODUCTS` in `src/types/index.ts`).
    *   Validation: Must be one of the defined products.
2.  **Customer Cohort:** (Required)
    *   UI Element: `Select` component.
    *   Options: Dynamically populated from `CUSTOMER_COHORTS` in `src/types/index.ts`, potentially filtered by cohorts used in the Knowledge Base.
    *   Validation: Must be one of the available cohorts.
3.  **Direct Context File:** (Optional)
    *   UI Element: `Input type="file"`.
    *   Options: Any file type (PDF, DOCX, TXT, CSV, etc.).
    *   Validation: Max file size 5MB (`MAX_DIRECT_UPLOAD_FILE_SIZE` in `pitch-form.tsx`).
    *   Behavior: If a plain text file (.txt, .md, .csv) under 100KB is uploaded, its content is read client-side and passed to the AI. For other types or larger files, only the file name and MIME type are passed, and the AI is instructed to try and use this metadata.
4.  **ET Plan Configuration:** (Optional, visible only if "Product" is "ET")
    *   UI Element: `Select` component.
    *   Options: "1, 2 and 3 year plans", "1, 3 and 7 year plans" (from `ET_PLAN_CONFIGURATIONS` in `src/types/index.ts`).
5.  **Sales Plan:** (Optional)
    *   UI Element: `Select` component.
    *   Options: "Monthly", "Quarterly", "Half-Yearly", "1-Year", "2-Years", "3-Years", "Custom" (from `SALES_PLANS` in `src/types/index.ts`).
6.  **Specific Offer Details:** (Optional)
    *   UI Element: `Input type="text"`.
    *   Validation: Max 200 characters.
    *   Example: "20% off annual plan", "TimesPrime bundle included".
7.  **Agent Name:** (Optional)
    *   UI Element: `Input type="text"`.
    *   Validation: Max 50 characters.
    *   Purpose: For personalizing the pitch script (e.g., "Hello, this is [Agent Name]...").
8.  **Customer Name:** (Optional)
    *   UI Element: `Input type="text"`.
    *   Validation: Max 50 characters.
    *   Purpose: For personalizing the pitch script (e.g., "Hello [Customer Name]...").

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   The user fills out the `PitchForm`, selecting the product, cohort, and any optional details.
    *   The user may upload a "Direct Context File".
    *   The user clicks the "Generate Pitch" button.
2.  **Frontend Logic (`pitch-generator/page.tsx` & `pitch-form.tsx`):**
    *   The `PitchForm`'s `onSubmit` handler (`handleGeneratePitch` in `page.tsx`) is triggered.
    *   **Knowledge Base Context Preparation:**
        *   A `knowledgeBaseContext` string is constructed.
        *   If a "Direct Context File" was uploaded:
            *   A special block is prefixed to `knowledgeBaseContext`:
                ```
                --- START OF UPLOADED FILE CONTEXT (PRIMARY SOURCE) ---
                File Name: [direct_file_name]
                File Type: [direct_file_type]
                Instruction to AI: [Detailed instructions on how to prioritize this file, and what to do if content couldn't be read client-side]
                --- BEGIN UPLOADED FILE CONTENT --- (if text content was read and <100KB)
                [direct_file_content]
                --- END UPLOADED FILE CONTENT ---
                --- END OF UPLOADED FILE CONTEXT ---
                ```
            *   If the file content wasn't read client-side, the instruction to the AI emphasizes using the file name and type for inference.
        *   The general Knowledge Base content for the selected product (and optionally cohort) is retrieved using the `prepareGeneralKnowledgeBaseContext` helper. This helper filters files from `useKnowledgeBase`, extracts text content (or provides file metadata for non-text entries), and appends it to `knowledgeBaseContext` after the direct file block (if any).
    *   An object matching the `GeneratePitchInput` schema from the Genkit flow is created, including all form data and the prepared `knowledgeBaseContextToUse`.
    *   The `generatePitch` flow function (imported from `/src/ai/flows/pitch-generator.ts`) is called with this input object.
    *   `isLoading` state is set to true.
    *   Upon receiving a response (or error) from the flow:
        *   `isLoading` is set to false.
        *   The `pitch` state is updated with the `GeneratePitchOutput` if successful.
        *   Any errors are caught and displayed using `toast` and set in the `error` state.
        *   The result (or error message) is logged via `useActivityLogger`.
3.  **Genkit Flow Internals (`pitch-generator.ts`):**
    *   **Input Schema (`GeneratePitchInputSchema`):** Defines the expected structure of the input from the frontend (product, customerCohort, knowledgeBaseContext, optional salesPlan, offer, agentName, userName, etPlanConfiguration).
    *   **Output Schema (`GeneratePitchOutputSchema`):** Defines the structured output the AI is expected to produce (pitchTitle, warmIntroduction, personalizedHook, productExplanation, keyBenefitsAndBundles, discountOrDealExplanation, objectionHandlingPreviews, finalCallToAction, fullPitchScript, estimatedDuration, notesForAgent). Each field has a detailed description guiding the AI on what content to generate and its expected distinctness.
    *   **Prompt Definition (`generatePitchPrompt` = `ai.definePrompt`):**
        *   Takes `GeneratePitchInputSchema` as input and aims for `GeneratePitchOutputSchema` as output.
        *   **Prompt Logic (Core Instructions to AI):**
            *   Sets the AI's persona as a telesales assistant for the given `{{{product}}}`.
            *   Receives product, cohort, offer, agent/user names via Handlebars `{{{variable}}}` syntax.
            *   Receives the crucial `{{{knowledgeBaseContext}}}`.
            *   **Critical Instructions for KB Usage:**
                *   The AI is explicitly told that `knowledgeBaseContext` is its **sole source** for product features, benefits, and details.
                *   It must **prioritize the "UPLOADED FILE CONTEXT" block** if present.
                *   If an uploaded file's content couldn't be read client-side, the AI is instructed to *attempt* to process it based on name/type or state it couldn't and use general KB, reporting this in `notesForAgent`.
                *   The AI must generate each distinct section of the pitch (introduction, hook, product explanation, benefits, etc.) by deriving information *only* from the KB, ensuring each section provides **new and distinct** information and avoids repetition.
                *   If the KB is sparse for a specific section, the AI must state what information would typically go there and suggest the agent refer to the full KB or source document, rather than inventing content.
                *   The `fullPitchScript` must be a smooth integration of all generated components, targeting 450-600 words for the agent's parts, using placeholders.
            *   Model: `googleai/gemini-1.5-flash-latest` (or as specified).
            *   Configuration: Temperature set (e.g., `0.4`) for a balance of creativity and consistency. Safety settings allow sales-related language.
    *   **Flow Execution (`generatePitchFlow` = `ai.defineFlow`):**
        *   Takes `GeneratePitchInput`, returns `Promise<GeneratePitchOutput>`.
        *   **KB Content Check:** Before calling the AI, it checks if `knowledgeBaseContext` is effectively empty (excluding direct uploads if a direct file was not the primary source). If so, it returns a specific error/placeholder output indicating insufficient KB content.
        *   Calls the `generatePitchPrompt` with the input.
        *   Handles potential errors from the AI call (e.g., API key issues, safety blocks, empty responses) and returns a structured error object within the `GeneratePitchOutput` schema (e.g., `pitchTitle` becomes error title, `warmIntroduction` contains error message).
        *   Validates the AI's output against `GeneratePitchOutputSchema` (implicitly done by Genkit based on the schema definition).
4.  **Display Result (UI):**
    *   The `PitchCard` component receives the `GeneratePitchOutput` and renders it in an accordion format, allowing the user to view each section and the full script.
    *   "Copy" and "Download" buttons use the generated content.

### **Data Structures:**

*   `GeneratePitchInput`, `GeneratePitchOutput` (defined in `src/ai/flows/pitch-generator.ts` and mirrored in `src/types/index.ts`).
*   `KnowledgeFile` (defined in `src/types/index.ts`) for items managed by `useKnowledgeBase`.
*   `PitchFormValues` (defined in `src/components/features/pitch-generator/pitch-form.tsx`).

### **Error Handling:**

*   Client-side form validation using Zod via `react-hook-form`.
*   Error handling within the `generatePitchFlow` for AI call failures or empty/invalid AI responses, returning structured error information.
*   Client-side `try...catch` when calling the flow function, displaying errors via `toast` and setting an error state.
*   The `PitchCard` component gracefully displays error messages if the `pitchTitle` or `warmIntroduction` indicate a failure.

---

## **2. AI Rebuttal Assistant**

### **Purpose & Overview:**
To provide sales agents with intelligent, context-aware rebuttals to customer objections in real-time (simulated). The AI uses product information from the Knowledge Base to suggest persuasive responses.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/rebuttal-generator/page.tsx`
*   **Frontend Form Component:** `/src/components/features/rebuttal-generator/rebuttal-form.tsx`
*   **Frontend Display Component:** `/src/components/features/rebuttal-generator/rebuttal-display.tsx`
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/rebuttal-generator.ts`
    *   Exports: `generateRebuttal` (async function), `GenerateRebuttalInput`, `GenerateRebuttalOutput`.
*   **AI Model:** `googleai/gemini-2.0-flash` (or as configured).

### **User Input Fields & Options (`rebuttal-form.tsx`):**

1.  **Product:** (Required)
    *   UI Element: `Select` component.
    *   Options: "ET", "TOI".
2.  **Customer Objection:** (Required)
    *   UI Element: `Textarea`.
    *   Validation: Min 5 characters, Max 500 characters.
    *   Helper Buttons: Provides quick-fill options for common objections (e.g., "It's too expensive," "I'll think about it").

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   User selects the "Product".
    *   User types in the "Customer Objection" or clicks a quick-fill button.
    *   User clicks "Get Rebuttal".
2.  **Frontend Logic (`rebuttal-generator/page.tsx` & `rebuttal-form.tsx`):**
    *   The `RebuttalForm` collects product and objection using `react-hook-form` and Zod validation.
    *   `knowledgeBaseContext` is prepared by the `prepareKnowledgeBaseContext` helper function (similar to Pitch Generator, it filters `useKnowledgeBase` entries for the selected product and concatenates their text content or metadata).
    *   An object matching `GenerateRebuttalInput` (objection, product, knowledgeBaseContext) is created.
    *   The `generateRebuttal` flow function is called.
    *   `isLoading` state is managed.
    *   The result (`GenerateRebuttalOutput`) or error is displayed using `RebuttalDisplay` or `toast`.
    *   Activity is logged.
3.  **Genkit Flow Internals (`rebuttal-generator.ts`):**
    *   **Input Schema (`GenerateRebuttalInputSchema`):** Defines `objection`, `product`, `knowledgeBaseContext`.
    *   **Output Schema (`GenerateRebuttalOutputSchema`):** Defines `rebuttal` (string).
    *   **Prompt Definition (`generateRebuttalPrompt`):**
        *   Sets AI persona as a telesales assistant specializing in rebuttals for the given `{{{product}}}`.
        *   Takes `{{{objection}}}` and `{{{knowledgeBaseContext}}}` as input.
        *   **Critical Instructions for KB Usage & Rebuttal Structure:**
            *   Analyze the core of the objection.
            *   Prioritize `knowledgeBaseContext` to find relevant facts, benefits, or selling themes to counter the specific objection.
            *   Synthesize KB info into a compelling argument (not just list facts).
            *   Structure the rebuttal (e.g., Acknowledge, Bridge, Benefit, Clarify/Question - ABBC/Q).
            *   If KB is sparse for the specific objection, acknowledge, pivot to a general strength from KB (if any), and ask clarifying questions.
            *   Strictly adhere to KB for product facts; do not invent.
            *   Maintain a confident, helpful, professional tone.
            *   The rebuttal should be detailed and comprehensive if needed.
        *   Model: `googleai/gemini-2.0-flash`. Temperature: `0.4`.
    *   **Flow Execution (`generateRebuttalFlow`):**
        *   Checks if `knowledgeBaseContext` is effectively empty. If so, returns a "Cannot generate rebuttal: No relevant knowledge base content..." message.
        *   Calls `generateRebuttalPrompt(input)`.
        *   Handles errors and empty/short responses from the AI, returning appropriate error messages in the `rebuttal` field.
4.  **Display Result (UI):**
    *   `RebuttalDisplay` shows the AI's suggested `rebuttal`.

### **Data Structures:**

*   `GenerateRebuttalInput`, `GenerateRebuttalOutput` (from flow and `src/types/index.ts`).
*   `KnowledgeFile`.

### **Error Handling:**

*   Zod schema validation for form inputs.
*   `try...catch` in the flow for AI errors.
*   UI displays errors via `toast` or an error state. Rebuttal field may contain error messages from the flow.

---

## **3. Audio Transcription**

### **Purpose & Overview:**
To convert uploaded audio files into text. The AI provides speaker diarization (identifying different speakers like AGENT, USER, RINGING), includes time allotments for speech segments, and offers a qualitative assessment of transcription accuracy. It also strictly enforces English (Roman script) output, transliterating any Hindi/Hinglish.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/transcription/page.tsx`
    *   Handles file uploads, manages state, calls the AI flow, and displays results.
*   **Frontend Display Component:** `/src/components/features/transcription/transcription-results-table.tsx` (for multiple files) or direct rendering for single file.
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/transcription-flow.ts`
    *   Exports: `transcribeAudio` (async function), `TranscriptionInput`, `TranscriptionOutput`.
*   **AI Model:** `googleai/gemini-2.0-flash` (or other audio-capable model via Google AI plugin).

### **User Input Fields & Options (`transcription/page.tsx`):**

1.  **Audio File(s):** (Required)
    *   UI Element: `Input type="file"` (multiple attribute enabled).
    *   Options: MP3, WAV, M4A, OGG, WEBM, AAC, FLAC (`ALLOWED_AUDIO_TYPES` in `page.tsx`).
    *   Validation: Max file size 100MB per file (`MAX_AUDIO_FILE_SIZE` in `page.tsx`). File type validation against `ALLOWED_AUDIO_TYPES`.

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   User selects one or more audio files via the file input.
    *   User clicks "Transcribe Audio".
2.  **Frontend Logic (`transcription/page.tsx`):**
    *   Client-side validation of file type and size.
    *   For each selected file:
        *   Converts the `File` object to a base64 encoded Data URI using `fileToDataUrl` utility.
        *   Creates a `TranscriptionInput` object: `{ audioDataUri: "data:audio/wav;base64,..." }`.
        *   Calls the `transcribeAudio` flow function.
        *   Collects results (or errors) for each file into an array of `TranscriptionResultItem`.
    *   `isLoading` state is managed.
    *   Displays results:
        *   If one file and successful: Shows in a dedicated Card with player and transcript.
        *   If multiple files or single file with error: Uses `TranscriptionResultsTable`.
    *   Activity is logged via `logBatchActivities`.
3.  **Genkit Flow Internals (`transcription-flow.ts`):**
    *   **Input Schema (`TranscriptionInputSchema`):** Defines `audioDataUri` (string, expecting Data URI format).
    *   **Output Schema (`TranscriptionOutputSchema`):** Defines `diarizedTranscript` (string with specific formatting rules) and `accuracyAssessment` (string: "High", "Medium", "Low", with reasons).
    *   **Prompt Definition (`transcribeAudioPrompt`):**
        *   Input: `audioDataUri` passed to the model via `{{media url=audioDataUri}}` Handlebars syntax.
        *   **Critical Instructions for Transcription Output (STRICT):**
            *   **Time Allotment & Dialogue Structure:** Segment audio into chunks. Each chunk starts with a time allotment (e.g., "[0 seconds - 15 seconds]") on a new line, followed by the speaker label and text on the next line.
            *   **Diarization & Speaker Labels (ALL CAPS):**
                *   "RINGING:" for initial ringing or automated messages (including pre-recorded voices like "Savdhan agar aapko...").
                *   "AGENT:" for the first clear human agent (identified by typical intros, controlling flow).
                *   "USER:" for the other primary human speaker.
                *   "SPEAKER 1:", "SPEAKER 2:" as fallback if roles are ambiguous, with attempt to switch to AGENT/USER if roles become clear later.
            *   **Non-Speech Sounds:** Label sounds like (Background Noise), (Silence) within the text portion, after the speaker label.
            *   **Language & Script (CRITICAL & STRICT):**
                *   Entire transcript MUST be English (Roman script) ONLY.
                *   Hindi/Hinglish words MUST be accurately transliterated into Roman script (e.g., "kya" for क्या).
                *   NO Devanagari or other non-Roman script characters.
            *   **Accuracy Assessment:** AI must self-assess transcription accuracy (High, Medium, Low) based on audio clarity and explain its reasoning.
            *   **Completeness:** Transcript must be complete.
        *   Model: `googleai/gemini-2.0-flash` (or other audio-capable model). Config: `temperature: 0.1`.
    *   **Flow Execution (`transcriptionFlow`):**
        *   Calls `transcribeAudioPrompt(input)`.
        *   Handles errors from the AI (e.g., unsupported audio, API issues, safety blocks), returning structured error messages within `TranscriptionOutput` (e.g., `diarizedTranscript` will contain "[Transcription Error: ...]", `accuracyAssessment` will be "Error").
        *   Validates that the AI output is not empty.
4.  **Display Result (UI):**
    *   For single, successful transcriptions: A card shows audio player, accuracy, and full transcript.
    *   For multiple files or errors: `TranscriptionResultsTable` lists each file with its status, accuracy, a preview, and a "View" button for full details in a dialog.

### **Data Structures:**

*   `TranscriptionInput`, `TranscriptionOutput` (from flow and `src/types/index.ts`).
*   `TranscriptionResultItem` (defined in `transcription/page.tsx` for UI state).

### **Error Handling:**

*   Client-side file validation (type, size).
*   `try...catch` in the flow for AI call errors. Errors from the AI or flow are encapsulated within the `TranscriptionOutput` structure for each file.
*   UI displays per-file errors in the results table or card.

---

## **4. AI Call Scoring**

### **Purpose & Overview:**
To analyze call transcripts (derived from uploaded audio files) for various sales performance metrics. The AI provides an overall score, categorization, and specific feedback on metrics like opening, needs discovery, product presentation, objection handling, and agent tone.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/call-scoring/page.tsx`
*   **Frontend Form Component:** `/src/components/features/call-scoring/call-scoring-form.tsx`
*   **Frontend Display Components:**
    *   `/src/components/features/call-scoring/call-scoring-results-card.tsx` (for single successful result)
    *   `/src/components/features/call-scoring/call-scoring-results-table.tsx` (for multiple results or errors)
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/call-scoring.ts`
    *   Exports: `scoreCall` (async function), `ScoreCallInput`, `ScoreCallOutput`.
    *   Internally depends on `/src/ai/flows/transcription-flow.ts`.
*   **AI Models:**
    *   Transcription part: Same as Transcription module (e.g., `googleai/gemini-2.0-flash`).
    *   Scoring part: `googleai/gemini-2.0-flash` (or similar text analysis model).

### **User Input Fields & Options (`call-scoring-form.tsx`):**

1.  **Product Focus:** (Required)
    *   UI Element: `Select` component.
    *   Options: "ET", "TOI".
2.  **Upload Audio File(s):** (Required)
    *   UI Element: `Input type="file"` (multiple attribute enabled).
    *   Options & Validation: Same as "Audio Transcription" module (MP3, WAV, etc., max 100MB per file).
3.  **Agent Name:** (Optional)
    *   UI Element: `Input type="text"`.
    *   Purpose: For context in the scoring report.

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   User selects "Product Focus".
    *   User uploads one or more audio files.
    *   Optionally enters "Agent Name".
    *   User clicks "Score Call(s)".
2.  **Frontend Logic (`call-scoring/page.tsx`):**
    *   The `CallScoringForm` collects inputs.
    *   For each audio file:
        *   Converts `File` to `audioDataUri`.
        *   Creates `ScoreCallInput` object: `{ audioDataUri, product, agentName }`.
        *   Calls the `scoreCall` flow function.
        *   Collects results/errors into an array of `ScoredCallResultItem`.
    *   `isLoading` and `processedFileCount` states are managed.
    *   Displays results using `CallScoringResultsCard` (for one successful file) or `CallScoringResultsTable`.
    *   Activity logged via `logBatchActivities`.
3.  **Genkit Flow Internals (`call-scoring.ts`):**
    *   **Input Schema (`ScoreCallInputSchema`):** `audioDataUri`, `product`, `agentName` (optional).
    *   **Output Schema (`ScoreCallOutputSchema`):** A structured object including `transcript`, `transcriptAccuracy`, `overallScore` (0-5), `callCategorisation` (e.g., "Very Good", "Error"), `metricScores` (array of {metric, score, feedback}), `summary`, `strengths`, `areasForImprovement`.
    *   **Flow Execution (`scoreCallFlow`):**
        *   **Step 1: Transcription (Internal Call):**
            *   Calls `transcribeAudio({ audioDataUri: input.audioDataUri })` from `transcription-flow.ts`.
            *   **CRITICAL Error Handling:** If transcription fails (e.g., audio issue, API error from transcription flow), the `scoreCallFlow` catches this and returns a specific error structure within `ScoreCallOutput`. This includes setting `transcript` to the error message from transcription, `transcriptAccuracy` to "Error", `overallScore` to 0, and providing specific feedback about the transcription failure. The flow does *not* proceed to scoring if transcription fails.
        *   **Step 2: Scoring (If Transcription Succeeded):**
            *   Prepares `ScoreCallPromptInputSchema` using the `transcript` from Step 1, and the original `product` and `agentName`.
            *   Calls `scoreCallPrompt(promptInput)`.
            *   If `scoreCallPrompt` itself returns no output or errors, it populates `ScoreCallOutput` with appropriate error messages for the scoring part, but *retains the successful transcript*.
            *   Combines the scoring output (from `ScoreCallPromptOutputSchema`) with the transcript details (`transcript`, `transcriptAccuracy`) to form the final `ScoreCallOutput`.
    *   **Prompt Definition (`scoreCallPrompt`):**
        *   Input: `ScoreCallPromptInputSchema` (transcript, product, agentName).
        *   Output: `ScoreCallPromptOutputSchema` (all fields from `ScoreCallOutputSchema` except transcript-related ones).
        *   **Prompt Logic (Core Instructions to AI):**
            *   Sets AI persona as an expert call quality analyst.
            *   Analyzes the provided `{{{transcript}}}` for a call about `{{{product}}}`.
            *   Instructs AI to evaluate against specific metrics: Opening & Rapport Building, Needs Discovery, Product Presentation (relevance to `{{{product}}}`), Objection Handling, Closing Effectiveness, Clarity & Communication, Agent's Tone & Professionalism, User's Perceived Sentiment, Product Knowledge (specific to `{{{product}}}`).
            *   Requires overall score (1-5), categorization (Very Good, etc.), detailed feedback for each metric (referencing transcript if possible), summary, strengths, and improvement areas.
            *   Emphasizes objectivity and adherence to the transcript.
        *   Model: `googleai/gemini-2.0-flash`. Config: `temperature: 0.2` (for more deterministic scoring).
4.  **Display Result (UI):**
    *   `CallScoringResultsCard` or `CallScoringResultsTable` display the detailed analysis.

### **Data Structures:**

*   `ScoreCallInput`, `ScoreCallOutput`, `MetricScoreSchema` (from flow and `src/types/index.ts`).
*   `TranscriptionOutput` (internally used by the flow).
*   `ScoredCallResultItem` (defined in `call-scoring-results-table.tsx` for UI state).

### **Error Handling:**

*   Client-side form validation.
*   Robust error handling within `scoreCallFlow` for both transcription and scoring phases.
    *   If transcription fails, a specific error structure is returned.
    *   If scoring fails after successful transcription, the transcript is preserved, and scoring-specific errors are noted.
*   UI displays per-file errors or overall errors via `toast` and in the results display.

---

## **5. Knowledge Base Management**

### **Purpose & Overview:**
To allow admin users (conceptually, as no roles are implemented) to upload, manage, and view documents and text entries. This content serves as the contextual knowledge source for AI features like Pitch Generation and Rebuttal Assistance.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/knowledge-base/page.tsx`
*   **Frontend Form Component:** `/src/components/features/knowledge-base/knowledge-base-form.tsx`
    *   Handles adding new files or text entries.
*   **Frontend Table Component:** `/src/components/features/knowledge-base/knowledge-base-table.tsx`
    *   Displays all entries and allows viewing/deleting.
*   **AI Orchestration:** N/A (This module is for data management to *feed* AI features, not direct AI generation itself).
*   **Genkit Flow:** N/A.
*   **AI Model:** N/A.
*   **Client-Side Storage:** `useKnowledgeBase` hook (`/src/hooks/use-knowledge-base.ts`) using browser Local Storage (`KNOWLEDGE_BASE_KEY`).

### **User Input Fields & Options (`knowledge-base-form.tsx`):**

1.  **Associated Product:** (Optional)
    *   UI Element: `Select` component.
    *   Options: "ET", "TOI".
2.  **Target Persona/Cohort:** (Optional)
    *   UI Element: `Select` component.
    *   Options: From `CUSTOMER_COHORTS`.
3.  **Entry Type:** (Required)
    *   UI Element: `RadioGroup` component.
    *   Options: "Upload File(s)", "Add Text/Prompt". Default: "Upload File(s)".
4.  **If "Upload File(s)":**
    *   **Knowledge File(s):** (Required if Entry Type is "file")
        *   UI Element: `Input type="file"` (multiple attribute enabled).
        *   Options: PDF, DOCX, CSV, TXT, audio types (MP3, WAV, etc.), presentation types (PPT, PPTX), spreadsheet types (XLS, XLSX). See `ALLOWED_FILE_TYPES` in `knowledge-base-form.tsx`.
        *   Validation: Max file size 50MB per file (`MAX_FILE_SIZE`). Type validation is advisory (console warning for unsupported but stored anyway).
5.  **If "Add Text/Prompt":**
    *   **Name/Title for Text Entry:** (Required if Entry Type is "text")
        *   UI Element: `Input type="text"`.
        *   Validation: Min 3 characters.
    *   **Text Content / Prompt:** (Required if Entry Type is "text")
        *   UI Element: `Textarea`.
        *   Validation: Min 10 characters.

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   **Adding Entries:**
        *   User selects "Entry Type".
        *   Optionally selects "Associated Product" and "Target Persona/Cohort".
        *   If "Upload File(s)": Selects one or more files.
        *   If "Add Text/Prompt": Enters a "Name/Title" and "Text Content".
        *   Clicks "Upload File(s)" or "Add Text Entry".
    *   **Viewing/Managing Entries (`KnowledgeBaseTable`):**
        *   Displays all entries with details (icon, name, product, persona, size/length, upload date).
        *   User can "View" (shows details in a dialog, including text content for text entries) or "Delete" entries (with confirmation).
    *   **Export/Clear (`knowledge-base/page.tsx`):**
        *   Button: "Export KB Log as CSV".
        *   Button: "Clear All KB Entries" (opens confirmation dialog).
        *   Button: "Download Full AI Prompts & Logic" (downloads a static, comprehensive text file containing all core AI prompts from the application).
2.  **Frontend Logic (`knowledge-base/page.tsx`, `knowledge-base-form.tsx`, `knowledge-base-table.tsx`):**
    *   **`KnowledgeBaseForm`:**
        *   Uses `react-hook-form` and Zod schema (`FormSchema`) for validation.
        *   Handles file selection or text input.
        *   On submit, calls `onSingleEntrySubmit` or `onMultipleFilesSubmit` props passed from `knowledge-base/page.tsx`.
    *   **`knowledge-base/page.tsx`:**
        *   Uses the `useKnowledgeBase` hook which provides `files` (array of `KnowledgeFile`), `addFile`, `addFilesBatch`, `deleteFile`, and `setFiles` functions.
        *   `handleAddSingleEntry` (called by form for text entries): Creates a `KnowledgeFile` object and calls `addFile` from the hook.
        *   `handleAddMultipleFiles` (called by form for file uploads): Iterates through uploaded `File` objects, creates `KnowledgeFile` objects, and calls `addFilesBatch`.
        *   `handleDeleteFile` (called by table): Calls `deleteFile` from the hook.
        *   `handleExportCsv`: Formats `files` from `useKnowledgeBase` and uses `exportToCsv` utility.
        *   `handleClearAllKnowledgeBase`: Calls `setFiles([])` after confirmation.
        *   `handleDownloadFullPrompts`: Uses `exportPlainTextFile` to download `ALL_PROMPTS_TEXT` (a hardcoded string within the page component).
    *   **`KnowledgeBaseTable`:** Receives `files` from `useKnowledgeBase` (via `page.tsx`) and renders them. Implements client-side sorting.
    *   **System Default Entries (`useKnowledgeBase` hook):**
        *   An `useEffect` within the `useKnowledgeBase` hook ensures that two system default text entries (one for "ET Prime", one for "TOI Plus", containing comprehensive product details - `ET_PRIME_COMPREHENSIVE_DETAILS`, `TOI_PLUS_COMPREHENSIVE_DETAILS`) are always present in the Knowledge Base.
        *   If these entries are missing or their content differs from the hardcoded master content, they are re-added or updated. User-added files are preserved during this process.
3.  **Knowledge Base Interaction (Directly via `useKnowledgeBase` hook):**
    *   All operations (add, delete, list) interact directly with the browser's Local Storage via the `useKnowledgeBase` hook.
4.  **Activity Logging (`useActivityLogger`):**
    *   `logActivity` is called for actions like:
        *   Add single/batch: `module: "Knowledge Base Management"`, `details: { action: 'add'/'add_batch', fileData/filesData }`.
        *   Delete: `details: { action: 'delete', fileId, name }`.
        *   Clear All: `details: { action: 'clear_all', countCleared }`.
        *   Download Prompts: `details: { action: 'download_full_prompts' }`.

### **Data Structures:**

*   `KnowledgeFile` (from `src/types/index.ts`): Includes `id`, `name`, `type` (MIME type or "text/plain" for text entries), `size` (bytes for files, char length for text), `product?`, `persona?`, `uploadDate`, `textContent?` (for text entries or small readable files), `isTextEntry?` (boolean).

### **Error Handling:**

*   Form validation for inputs (e.g., required fields for text entries, file size for uploads).
*   `toast` notifications for success/error messages (e.g., "Entry Added", "Export Failed").
*   Confirmation dialog for "Clear All KB Entries".

---

## **6. Training Material Creator**

### **Purpose & Overview:**
To assist users in generating structured content outlines for training materials such as presentations (PPT), documents (Word Doc, PDF), or brochures. The AI uses contextual information from various sources (direct user prompt, uploaded files, or Knowledge Base entries) to create a title and multiple content sections.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/create-training-deck/page.tsx`
    *   Manages user selections for product, format, and context source.
    *   Handles file uploads for direct context.
    *   Calls the AI flow and displays the generated material.
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/training-deck-generator.ts`
    *   Exports: `generateTrainingDeck` (async function), `GenerateTrainingDeckInput`, `GenerateTrainingDeckOutput`.
*   **AI Model:** `googleai/gemini-2.0-flash` (or as configured).

### **User Input Fields & Options (`create-training-deck/page.tsx`):**

1.  **Product:** (Required)
    *   UI Element: `Select` component.
    *   Options: "ET", "TOI".
2.  **Output Format:** (Required)
    *   UI Element: `Select` component.
    *   Options: "PDF", "Word Doc", "PPT", "Brochure" (`DECK_FORMATS` in `page.tsx`). This influences the AI's suggested content style and structure.
3.  **Context Source (Choose ONE):**
    *   **Direct Prompt:**
        *   UI Element: `Textarea`.
        *   Validation: Min 10 characters if this option is chosen as the primary context.
        *   User describes the desired training material.
    *   **Directly Upload File(s):**
        *   UI Element: `Input type="file"` (multiple).
        *   Options: PDF, DOCX, TXT, CSV, etc.
        *   Validation: Max total upload size 10MB (`MAX_TOTAL_UPLOAD_SIZE`). Text content from small (<50KB) text files is read client-side.
    *   **Select Files from Knowledge Base:**
        *   UI Element: HTML `select multiple` list.
        *   Options: Lists `KnowledgeFile` entries from `useKnowledgeBase`, filtered by the selected "Product".
        *   User can select one or more KB items.
4.  **Generation Buttons:**
    *   "Generate from Provided Context": Uses the single chosen context source (Direct Prompt, Direct Uploads, or Selected KB Items). Disabled if no valid context is chosen.
    *   "Generate from Entire KB for {Product}": Uses all Knowledge Base entries associated with the selected "Product". Disabled if the KB is empty for that product.

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   User selects "Product" and "Output Format".
    *   User chooses **one** context source:
        *   Writes a "Direct Prompt".
        *   "Directly Uploads File(s)".
        *   "Selects Files from Knowledge Base".
    *   User clicks either "Generate from Provided Context" or "Generate from Entire KB for {Product}".
2.  **Frontend Logic (`create-training-deck/page.tsx`):**
    *   Manages state for selections, uploaded files, and the direct prompt.
    *   **Context Preparation (`handleGenerateMaterial`):**
        *   If "Direct Prompt" is the active context:
            *   `knowledgeBaseItems` becomes an array with one item: `{ name: "User-Provided Prompt", textContent: directPrompt, isTextEntry: true, fileType: "text/plain" }`.
            *   `sourceDescriptionForAi` is set to "context from a direct user-provided prompt".
        *   If "Direct Uploads" is the active context:
            *   Uploaded `File` objects are mapped to `FlowKnowledgeBaseItemSchema`. For text files < 50KB, `textContent` is read; otherwise, `textContent` is undefined.
            *   `sourceDescriptionForAi` lists the uploaded file names.
        *   If "Selected KB Items" is the active context:
            *   Chosen `KnowledgeFile` items are mapped to `FlowKnowledgeBaseItemSchema`. `textContent` is included for text entries.
            *   `sourceDescriptionForAi` lists the selected KB item names.
        *   If "Generate from Entire KB" button is clicked:
            *   All `KnowledgeFile` items from `useKnowledgeBase` filtered by the selected `product` are mapped to `FlowKnowledgeBaseItemSchema`.
            *   `generateFromAllKb` flag is set to true.
            *   `sourceDescriptionForAi` indicates "entire Knowledge Base for product {selectedProduct}".
    *   A `GenerateTrainingDeckInput` object is assembled with product, format hint, the prepared `knowledgeBaseItems`, `generateFromAllKb` flag, and `sourceDescriptionForAi`.
    *   The `generateTrainingDeck` flow function is called.
    *   `isLoading` state is managed.
    *   The returned `GenerateTrainingDeckOutput` (or error) is displayed.
    *   "Copy" and "Download" (as PDF or Text for Word/PPT) options are provided for the generated material.
    *   Activity is logged.
3.  **Genkit Flow Internals (`training-deck-generator.ts`):**
    *   **Input Schema (`GenerateTrainingDeckInputSchema`):** `product`, `deckFormatHint`, `knowledgeBaseItems` (array of `KnowledgeBaseItemSchemaInternal` which includes `name`, `textContent?`, `isTextEntry`, `fileType?`), `generateFromAllKb` (boolean), `sourceDescriptionForAi`.
    *   **Output Schema (`GenerateTrainingDeckOutputSchema`):** `deckTitle`, `sections` (array of `ContentSectionSchema` with `title`, `content`, `notes?`).
    *   **Prompt Definition (`generateTrainingMaterialPrompt`):**
        *   Sets AI persona as a presentation/documentation specialist for `{{{product}}}`.
        *   Inputs: `{{{product}}}`, `{{{deckFormatHint}}}`, `{{{sourceDescriptionForAi}}}`, and iterates through `{{{knowledgeBaseItems}}}` (displaying name, type, and textContent excerpt if available).
        *   **Special Case Frameworks (Critical):**
            *   If inputs indicate "ET Prime – Sales Training Deck" (based on product and `sourceDescriptionForAi` or item names/content), the AI *must* use a predefined 3-slide framework (Title, What is ET Prime?, Key Benefits), fleshing out details from the provided context.
            *   If inputs indicate "Telesales Data Analysis Framework", the AI *must* use a predefined 9-section framework (Title, Objective, Data Sources, Metrics, etc.), adapting for `{{{product}}}`.
        *   **General Case:** If no special case applies, the AI synthesizes the provided context into a logical structure with at least 3 sections.
        *   **Content Style Guidance:** Adapts content style (narrative/paragraph for PDF/Brochure, concise/bullets for Word/PPT) based on `{{{deckFormatHint}}}`. Includes textual suggestions for visuals (e.g., "(Visual: ...)") for Brochures/PDFs.
        *   If context is sparse, AI should state this and provide a placeholder structure.
        *   Model: `googleai/gemini-2.0-flash`.
    *   **Flow Execution (`generateTrainingDeckFlow`):**
        *   Calls `generateTrainingMaterialPrompt(input)`.
        *   Performs basic validation on the output structure (e.g., presence of title and sections).
        *   Handles errors, returning a structured error in `GenerateTrainingDeckOutput` format.
4.  **Display Result (UI):**
    *   The generated `deckTitle` and `sections` are displayed using an `Accordion` component.

### **Data Structures:**

*   `GenerateTrainingDeckInput`, `GenerateTrainingDeckOutput`, `KnowledgeBaseItemSchemaInternal`, `ContentSectionSchema` (from flow and `src/types/index.ts`).
*   `KnowledgeFile`.
*   `DeckFormat` (local type in `page.tsx`).

### **Error Handling:**

*   Client-side validation for product/format selection and ensuring at least one context source is chosen.
*   Error handling in the Genkit flow for AI failures, returning errors within the `GenerateTrainingDeckOutput` structure.
*   UI displays errors via `toast` and an error state variable.

---

## **7. AI Data Analyst**

### **Purpose & Overview:**
To provide AI-powered analysis of user-described data files (e.g., Excel, CSV). The AI simulates data cleaning, interpretation, and analysis based on a **detailed user prompt** and **file metadata (names, types)**, outputting a structured report. It does *not* directly process the binary content of large, complex files like Excel; its understanding comes from the user's textual descriptions.

### **Tech Stack & Key Components:**

*   **Frontend Page:** `/src/app/(main)/data-analysis/page.tsx`
*   **Frontend Form Component:** `/src/components/features/data-analysis/data-analysis-form.tsx`
*   **Frontend Display Component:** `/src/components/features/data-analysis/data-analysis-results-card.tsx`
*   **AI Orchestration:** Genkit
*   **Genkit Flow:** `/src/ai/flows/data-analyzer.ts`
    *   Exports: `analyzeData` (async function), `DataAnalysisInput`, `DataAnalysisReportOutput`.
*   **AI Model:** `googleai/gemini-2.0-flash` (or a more powerful version due to complexity, configured in flow).

### **User Input Fields & Options (`data-analysis-form.tsx`):**

1.  **"Upload" Context Files (Names & Types):** (Required)
    *   UI Element: `Input type="file"` (multiple).
    *   Options: Any file type (Excel, CSV, TXT, PDF, DOCX, ZIP, etc.). The AI uses names and types as context.
    *   Validation (Client-side advisory): Max 1GB per file for selection. The AI doesn't process full binary content of large/complex files.
2.  **Your Specific Analysis Prompt & Data Description:** (Required)
    *   UI Element: `Textarea`.
    *   Validation: Min 50 characters, Max 10,000 characters.
    *   **Crucial Input:** User must describe:
        *   The files they've "uploaded" (e.g., "Monthly MIS in Excel with sheets for Oct-May...").
        *   Their likely data structure (columns, data types, date formats, decoding rules for coded fields like 'NR' = Not Reachable).
        *   Specific file mappings (e.g., "'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'").
        *   Analytical goals for the current run (e.g., "Focus on Q4 & Q1 trends for conversion rates...").
        *   Known data messiness (e.g., misaligned headers, merged rows) for the AI to simulate cleaning.

### **Feature Creation Procedure & Data Flow:**

1.  **User Interaction (UI):**
    *   User "uploads" one or more files (to provide their names and types as context).
    *   User writes a **detailed analysis prompt** describing the data and analytical goals.
    *   User clicks "Generate Analysis Report".
2.  **Frontend Logic (`data-analysis/page.tsx` & `data-analysis-form.tsx`):**
    *   `DataAnalysisForm` collects files and the detailed prompt.
    *   `fileDetails` array (containing `{ fileName: string, fileType: string }` for each "uploaded" file) is created.
    *   If the first uploaded file is CSV or TXT, a small sample of its content (`sampledFileContent`, first ~10k chars) is read client-side.
    *   A `DataAnalysisInput` object is assembled: `{ fileDetails, userAnalysisPrompt, sampledFileContent? }`.
    *   The `analyzeData` flow function is called.
    *   `isLoading` state is managed.
    *   The returned `DataAnalysisReportOutput` (or error) is displayed using `DataAnalysisResultsCard`.
    *   Activity is logged.
3.  **Genkit Flow Internals (`data-analyzer.ts`):**
    *   **Input Schema (`DataAnalysisInputSchema`):** `fileDetails` (array of {fileName, fileType}), `userAnalysisPrompt` (string), `sampledFileContent?` (string).
    *   **Output Schema (`DataAnalysisReportSchema`):** A highly structured JSON object. Key fields include:
        *   `reportTitle`
        *   `executiveSummary`
        *   `keyMetrics` (array of {metricName, value, trendOrComparison?, insight?})
        *   `detailedAnalysis` (object with sub-sections like `dataReconstructionAndNormalizationSummary`, `smartTableRecognitionSummary`, `timeSeriesTrends`, `comparativePerformance`, `useCaseSpecificInsights`)
        *   `chartsOrTablesSuggestions?` (array of {type, title, description})
        *   `recommendations` (array of {area, recommendation, justification?})
        *   `directInsightsFromSampleText?` (if sample was provided)
        *   `limitationsAndDisclaimer` (mandatory AI-generated disclaimer).
    *   **Prompt Definition (`dataAnalysisReportPrompt`):**
        *   Sets AI persona as an advanced Excel analyst AI specializing in telesales.
        *   Inputs: `{{{fileDetails}}}`, `{{{userAnalysisPrompt}}}`, `{{{sampledFileContent}}}`.
        *   **Critical Instructions for Simulated Analysis:**
            *   The AI is explicitly told its analysis is **based solely on the user's textual descriptions, file metadata, and any provided text samples.** It does *not* see the content of binary files like Excel.
            *   The prompt guides the AI to *act as if* it has performed:
                1.  Data Reconstruction (Simulated Cleanup): Based on user's description of messiness.
                2.  Table Normalization (Simulated): Reconstructing described sheets into conceptual clean tables.
                3.  Smart Table Recognition: Inferring table purposes from user's descriptions.
                4.  KPI Calculation: Based on described fields and assumed clean data (e.g., AI is told how to define Conversion Rate from user-described fields).
                5.  Insight Generation: Populating detailed analysis sections.
            *   **Output Structure:** Strict adherence to `DataAnalysisReportSchema`.
            *   **Emphasis:** Interpret, don't just describe. Be specific. Provide actionable recommendations. Include the mandatory disclaimer about not processing full binary files.
            *   If user prompt is insufficient, AI should state that clearly.
        *   Model: `googleai/gemini-2.0-flash` (or higher tier due to complexity). Config: `temperature: 0.3`.
    *   **Flow Execution (`dataAnalysisReportFlow`):**
        *   Validates `userAnalysisPrompt` length (min 50 chars). If too short, returns a predefined error structure.
        *   Calls `dataAnalysisReportPrompt(input)`.
        *   Ensures the `limitationsAndDisclaimer` is always present in the output.
        *   Handles errors from the AI call, returning a fallback error structure within `DataAnalysisReportOutput` schema.
4.  **Display Result (UI):**
    *   `DataAnalysisResultsCard` renders the structured report, typically using accordions for different sections.

### **Data Structures:**

*   `DataAnalysisInput`, `DataAnalysisReportOutput`, `KeyMetricSchema`, `ChartTableSuggestionSchema` (from flow and `src/types/index.ts`).
*   `AnalysisReportResultItem` (defined in `data-analysis/page.tsx` for UI state).

### **Error Handling:**

*   Client-side validation for prompt length and file selection.
*   Flow handles insufficient prompt or AI errors, returning structured error reports.
*   UI displays errors or the full report.

---

## **8. Dashboards (Activity, Transcription, Call Scoring, Training Material, Data Analysis)**

### **Purpose & Overview:**
To provide users with historical views of activities performed and AI-generated outputs from various modules, enabling review, tracking, and export of logged data.

### **Tech Stack & Key Components:**

*   **Frontend Pages (Example: Activity Dashboard - others follow similar pattern):**
    *   `/src/app/(main)/activity-dashboard/page.tsx`
    *   `/src/app/(main)/transcription-dashboard/page.tsx`
    *   `/src/app/(main)/call-scoring-dashboard/page.tsx`
    *   `/src/app/(main)/training-material-dashboard/page.tsx`
    *   `/src/app/(main)/data-analysis-dashboard/page.tsx`
*   **Frontend Table Components:**
    *   `/src/components/features/activity-dashboard/activity-table.tsx`
    *   `/src/components/features/transcription-dashboard/dashboard-table.tsx`
    *   `/src/components/features/call-scoring-dashboard/dashboard-table.tsx`
    *   `/src/components/features/training-material-dashboard/dashboard-table.tsx`
    *   `/src/components/features/data-analysis-dashboard/dashboard-table.tsx`
*   **Frontend Filter Component (Activity Dashboard only):**
    *   `/src/components/features/activity-dashboard/filters.tsx`
*   **AI Orchestration/Genkit/AI Model:** N/A (Dashboards display logged data from Local Storage, they don't perform new AI operations).
*   **Client-Side Storage:** `useActivityLogger` hook (`/src/hooks/use-activity-logger.ts`) to retrieve logged activities from Local Storage.

### **User Input Fields & Options (Example: Activity Dashboard):**

1.  **Date From:** (Optional)
    *   UI Element: `DatePicker` (via `Popover` and `Calendar`).
2.  **Date To:** (Optional)
    *   UI Element: `DatePicker`.
3.  **Agent Name:** (Optional)
    *   UI Element: `Input type="text"`.
4.  **Module:** (Optional)
    *   UI Element: `Select` component.
    *   Options: Dynamically populated based on unique `module` values found in logged activities. Includes "All Modules".
5.  **Product:** (Optional)
    *   UI Element: `Select` component.
    *   Options: "All Products", "ET", "TOI".

### **Feature Creation Procedure & Data Flow (General Pattern):**

1.  **User Interaction (UI):**
    *   User navigates to a specific dashboard page.
    *   **Activity Dashboard:** User can apply filters and click "Apply Filters".
    *   All dashboards:
        *   Table displays historical items.
        *   User can click "View" on a table row to see details in a dialog.
        *   User can use "Export Options" dropdown to export table data as CSV, PDF, or Text for Word.
2.  **Frontend Logic (Page Components like `activity-dashboard/page.tsx`):**
    *   Uses `useActivityLogger` to get the `activities` array from Local Storage.
    *   `useEffect` sets an `isClient` flag to `true` to prevent hydration mismatches when accessing Local Storage data.
    *   **Filtering (Activity Dashboard):**
        *   `ActivityDashboardFilters` component manages draft filter state.
        *   On "Apply Filters", the page's `filters` state is updated, triggering `useMemo`.
        *   `useMemo` recalculates `filteredActivities` based on selected filter values (date range, agent name, module, product).
    *   **Data Transformation (Specific Dashboards):**
        *   Each dashboard page (`call-scoring-dashboard/page.tsx`, etc.) filters the global `activities` array by `module`.
        *   It then maps the relevant `activity.details` to a specific historical item type (e.g., `HistoricalScoreItem`, `HistoricalTranscriptionItem`) suitable for its dedicated table.
    *   **Sorting & Display:** Table components (`ActivityTable`, `CallScoringDashboardTable`, etc.) receive the filtered/transformed historical items and handle client-side sorting and rendering.
    *   **View Details:**
        *   Clicking "View" on a row sets a `selectedItem` state and opens a `Dialog` component.
        *   The dialog content dynamically renders the details of the `selectedItem`. This often involves re-using the main display components from the feature itself (e.g., `CallScoringResultsCard`, `PitchCard`) or formatting the data appropriately for display.
    *   **Export Logic:**
        *   When an export option is chosen:
            *   The currently displayed (and filtered, if applicable) data in the table is mapped to a simpler array of objects suitable for export.
            *   Utility functions from `/src/lib/export.ts` (`exportToCsv`, `exportTableDataToPdf`, `exportTableDataForDoc`) are called with the formatted data, headers, and desired filename.
3.  **Activity Logging (`useActivityLogger`):**
    *   These dashboard modules primarily *consume* data logged by other features. They do not typically log new activities themselves, except for potential errors during export.

### **Data Structures:**

*   `ActivityLogEntry` (base type from `src/types/index.ts`).
*   Specific historical item types used by each dashboard page (e.g., `HistoricalScoreItem`, `HistoricalTranscriptionItem`, `HistoricalMaterialItem`, `HistoricalAnalysisReportItem`), which are typically `ActivityLogEntry` cast to a more specific `details` structure.

### **Error Handling:**

*   Graceful handling if Local Storage data is missing or malformed (though `useLocalStorage` attempts to initialize with a default).
*   `toast` notifications for export success or failure.
*   Error messages within dialogs if detailed data cannot be rendered.

---
This detailed breakdown should provide a comprehensive understanding of each module's architecture and operation within the AI_TeleSuite application.
