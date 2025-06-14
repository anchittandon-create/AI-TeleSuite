
# AI_TeleSuite Replication Prompt for Luvable AI

**Objective:** Replicate the AI_TeleSuite application.

**Core Tech Stack (AI_TeleSuite):**
*   **Frontend:** Next.js (v15+, App Router, Server Components by default), React (v18+).
*   **UI Components:** ShadCN UI components.
*   **Styling:** Tailwind CSS, with theme variables (primary, accent, background colors) in `src/app/globals.css`.
*   **AI Orchestration & Backend Logic:** Genkit (v1.x), primarily using the `@genkit-ai/googleai` plugin to interact with Google's Gemini models (e.g., `gemini-1.5-flash-latest`, `gemini-2.0-flash`). Genkit flows run within the Next.js server-side environment.
*   **Language:** TypeScript.
*   **Forms:** `react-hook-form` for form state, `zod` for schema definition and validation (client & server/flow side).
*   **Client-Side Data Persistence:**
    *   `useKnowledgeBase` (`/src/hooks/use-knowledge-base.ts`): Manages Knowledge Base entries using Local Storage via `KNOWLEDGE_BASE_KEY`.
    *   `useActivityLogger` (`/src/hooks/use-activity-logger.ts`): Manages a log of user and AI activities using Local Storage via `ACTIVITY_LOG_KEY`.
    *   `useUserProfile` (`/src/hooks/useUserProfile.ts`): Provides a fixed user profile (e.g., "Anchit") for activity attribution.

---

## **Modules to Replicate (excluding Voice Agent deep implementation):**

---

### **1. AI Pitch Generator**

**Purpose & Overview:**
Generates tailored sales pitches by synthesizing product information from the Knowledge Base (and optionally a direct context file) with user-defined parameters.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/pitch-generator/page.tsx` (UI orchestration, state management, calls AI flow).
*   **Frontend Form Component:** `/src/components/features/pitch-generator/pitch-form.tsx` (`react-hook-form`, Zod schema for inputs, handles direct file upload for context).
*   **Frontend Display Component:** `/src/components/features/pitch-generator/pitch-card.tsx` (Displays structured AI output in accordion, with Copy/Download).
*   **Genkit Flow:** `/src/ai/flows/pitch-generator.ts` (Exports: `generatePitch` async function, `GeneratePitchInput` Zod schema, `GeneratePitchOutput` Zod schema).
*   **AI Model:** `googleai/gemini-1.5-flash-latest` (or similar, configured in the flow).

**User Input Fields & Options (`pitch-form.tsx`):**
1.  **Product:** (Required) `Select`. Options: "ET", "TOI".
2.  **Customer Cohort:** (Required) `Select`. Options: Dynamically from `CUSTOMER_COHORTS` (e.g., "Business Owners", "Payment Dropoff", etc.).
3.  **Direct Context File:** (Optional) `Input type="file"`. Any file type. Max 5MB. If plain text < 100KB, content is passed; otherwise, name/type for AI inference.
4.  **ET Plan Configuration:** (Optional, if "Product" is "ET") `Select`. Options: "1, 2 and 3 year plans", "1, 3 and 7 year plans".
5.  **Sales Plan:** (Optional) `Select`. Options: "Monthly", "Quarterly", "1-Year", "Custom", etc.
6.  **Specific Offer Details:** (Optional) `Input type="text"`. Max 200 chars. Example: "20% off annual".
7.  **Agent Name:** (Optional) `Input type="text"`. Max 50 chars. For script personalization.
8.  **Customer Name:** (Optional) `Input type="text"`. Max 50 chars. For script personalization.

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User fills `PitchForm`, may upload context file, clicks "Generate Pitch".
2.  **Frontend (`page.tsx` & `pitch-form.tsx`):**
    *   `onSubmit` handler constructs `knowledgeBaseContextToUse`:
        *   If Direct Context File: Prefixes a block with file metadata and (if readable) content, instructing AI to prioritize it.
        *   Appends general KB content for selected product (and cohort if relevant) via `prepareGeneralKnowledgeBaseContext` helper (filters `useKnowledgeBase` entries, extracts text/metadata).
    *   Creates `GeneratePitchInput` object (form data + `knowledgeBaseContextToUse`).
    *   Calls `generatePitch` flow function. Manages `isLoading`.
    *   Displays `GeneratePitchOutput` or error (via `toast`). Logs activity.
3.  **Genkit Flow (`pitch-generator.ts`):**
    *   `GeneratePitchInputSchema`: Defines inputs (product, cohort, kbContext, optional plan, offer, names, etConfig).
    *   `GeneratePitchOutputSchema`: Defines structured output (pitchTitle, warmIntroduction, personalizedHook, productExplanation, keyBenefitsAndBundles, discountOrDealExplanation, objectionHandlingPreviews, finalCallToAction, fullPitchScript, estimatedDuration, notesForAgent). Each field has detailed AI guidance.
    *   `generatePitchPrompt` (`ai.definePrompt`):
        *   AI Persona: Telesales assistant for `{{{product}}}`.
        *   Inputs: All from `GeneratePitchInputSchema` via Handlebars `{{{variable}}}`.
        *   **Critical KB Usage Instructions:**
            *   `knowledgeBaseContext` is AI's **sole source** for product details.
            *   **Prioritize "UPLOADED FILE CONTEXT" block** if present.
            *   If uploaded file content isn't readable client-side, AI tries inference from metadata or states inability in `notesForAgent`.
            *   Each pitch section (intro, hook, etc.) must be distinct, derived from KB, and avoid repetition.
            *   If KB is sparse for a section, AI states what's missing and refers agent to source, *not* invent.
            *   `fullPitchScript` (450-600 words agent dialogue) integrates all components.
        *   Model: `googleai/gemini-1.5-flash-latest`. Config: `temperature: 0.4`.
    *   `generatePitchFlow` (`ai.defineFlow`):
        *   Checks if `knowledgeBaseContext` is effectively empty (excluding non-prioritized direct uploads). If so, returns error/placeholder.
        *   Calls `generatePitchPrompt`. Handles AI errors, validates output.
4.  **UI Display:** `PitchCard` renders the accordion output.

---

### **2. AI Rebuttal Assistant**

**Purpose & Overview:**
Provides intelligent, context-aware rebuttals to customer objections using Knowledge Base content.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/rebuttal-generator/page.tsx`.
*   **Frontend Form Component:** `/src/components/features/rebuttal-generator/rebuttal-form.tsx`.
*   **Frontend Display Component:** `/src/components/features/rebuttal-generator/rebuttal-display.tsx`.
*   **Genkit Flow:** `/src/ai/flows/rebuttal-generator.ts` (Exports: `generateRebuttal` function, `GenerateRebuttalInput`, `GenerateRebuttalOutput`).
*   **AI Model:** `googleai/gemini-2.0-flash`.

**User Input Fields & Options (`rebuttal-form.tsx`):**
1.  **Product:** (Required) `Select`. Options: "ET", "TOI".
2.  **Customer Objection:** (Required) `Textarea`. Min 5, Max 500 chars. Helper buttons for common objections.

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User selects Product, enters Objection, clicks "Get Rebuttal".
2.  **Frontend:**
    *   `knowledgeBaseContext` prepared (filters `useKnowledgeBase` for product, concatenates text/metadata).
    *   Creates `GenerateRebuttalInput` (objection, product, kbContext).
    *   Calls `generateRebuttal` flow. Manages `isLoading`. Displays result/error. Logs activity.
3.  **Genkit Flow (`rebuttal-generator.ts`):**
    *   `GenerateRebuttalInputSchema`: `objection`, `product`, `knowledgeBaseContext`.
    *   `GenerateRebuttalOutputSchema`: `rebuttal` (string).
    *   `generateRebuttalPrompt`:
        *   AI Persona: Telesales assistant for `{{{product}}}` specializing in rebuttals.
        *   Inputs: `{{{objection}}}`, `{{{knowledgeBaseContext}}}`.
        *   **Critical KB Usage & Rebuttal Structure:**
            *   Analyze objection core. Prioritize KB to find relevant facts/benefits.
            *   Synthesize KB info into compelling argument (ABBC/Q: Acknowledge, Bridge, Benefit, Clarify/Question).
            *   If KB sparse, acknowledge, pivot to general KB strength, ask clarifying questions.
            *   Strictly adhere to KB; do not invent. Maintain professional tone.
        *   Model: `googleai/gemini-2.0-flash`. `temperature: 0.4`.
    *   `generateRebuttalFlow`:
        *   Checks for empty `knowledgeBaseContext`. Calls prompt. Handles AI errors.
4.  **UI Display:** `RebuttalDisplay` shows AI's `rebuttal`.

---

### **3. Audio Transcription**

**Purpose & Overview:**
Converts uploaded audio files to text with speaker diarization, time allotments, accuracy assessment, and strict English (Roman script) output.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/transcription/page.tsx` (Handles uploads, calls flow, displays results).
*   **Frontend Display Component:** `/src/components/features/transcription/transcription-results-table.tsx` (for multiple files) or direct card for single.
*   **Genkit Flow:** `/src/ai/flows/transcription-flow.ts` (Exports: `transcribeAudio` function, `TranscriptionInput`, `TranscriptionOutput`).
*   **AI Model:** `googleai/gemini-2.0-flash` (or other audio-capable via Google AI plugin).

**User Input Fields & Options (`transcription/page.tsx`):**
1.  **Audio File(s):** (Required) `Input type="file"` (multiple). Options: MP3, WAV, M4A, etc. (`ALLOWED_AUDIO_TYPES`). Max 100MB/file (`MAX_AUDIO_FILE_SIZE`).

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User selects audio file(s), clicks "Transcribe Audio".
2.  **Frontend:**
    *   Validates file type/size. For each file:
        *   Converts `File` to base64 Data URI (`fileToDataUrl`).
        *   Creates `TranscriptionInput` (`{ audioDataUri }`).
        *   Calls `transcribeAudio` flow. Collects results/errors.
    *   Manages `isLoading`. Displays in card or table. Logs activity.
3.  **Genkit Flow (`transcription-flow.ts`):**
    *   `TranscriptionInputSchema`: `audioDataUri`.
    *   `TranscriptionOutputSchema`: `diarizedTranscript` (string with specific formatting), `accuracyAssessment` (string: "High/Medium/Low" + reasons).
    *   `transcribeAudioPrompt`:
        *   Input: `{{media url=audioDataUri}}`.
        *   **Critical Output Instructions (STRICT):**
            *   **Time Allotment & Structure:** "[time - time]" new line, then "SPEAKER: text" new line.
            *   **Diarization Labels (ALL CAPS):** "RINGING:" (initial IVR/auto-messages), "AGENT:", "USER:", "SPEAKER 1/2:" (fallback, switch to AGENT/USER if roles clarify).
            *   **Non-Speech Sounds:** (Background Noise), (Silence) in text part.
            *   **Language & Script (CRITICAL):** English (Roman script) ONLY. Hindi/Hinglish transliterated (e.g., "kya" not "क्या"). NO Devanagari.
            *   **Accuracy Assessment:** AI self-assesses (High, Medium, Low) with reasons.
            *   **Completeness:** Full transcript.
        *   Model: `googleai/gemini-2.0-flash`. `temperature: 0.1`.
    *   `transcriptionFlow`: Calls prompt. Handles AI errors (encapsulated in `TranscriptionOutput`). Validates non-empty output.
4.  **UI Display:** Single success in Card (player, accuracy, transcript). Multiple/errors in `TranscriptionResultsTable`.

---

### **4. AI Call Scoring**

**Purpose & Overview:**
Analyzes call transcripts (from uploaded audio) for sales performance metrics, providing scores and feedback.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/call-scoring/page.tsx`.
*   **Frontend Form Component:** `/src/components/features/call-scoring/call-scoring-form.tsx`.
*   **Frontend Display:** `/src/components/features/call-scoring/call-scoring-results-card.tsx` or `call-scoring-results-table.tsx`.
*   **Genkit Flow:** `/src/ai/flows/call-scoring.ts` (Exports: `scoreCall` function, `ScoreCallInput`, `ScoreCallOutput`). Internally calls `transcription-flow.ts`.
*   **AI Models:** Transcription: `googleai/gemini-2.0-flash`. Scoring: `googleai/gemini-2.0-flash`.

**User Input Fields & Options (`call-scoring-form.tsx`):**
1.  **Product Focus:** (Required) `Select`. Options: "ET", "TOI".
2.  **Upload Audio File(s):** (Required) `Input type="file"` (multiple). Same as Transcription module.
3.  **Agent Name:** (Optional) `Input type="text"`. For report context.

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User selects Product, uploads audio, optionally Agent Name, clicks "Score Call(s)".
2.  **Frontend:**
    *   For each audio file: Converts to `audioDataUri`. Creates `ScoreCallInput`. Calls `scoreCall` flow. Collects results/errors.
    *   Manages `isLoading`, `processedFileCount`. Displays in card or table. Logs activity.
3.  **Genkit Flow (`call-scoring.ts`):**
    *   `ScoreCallInputSchema`: `audioDataUri`, `product`, `agentName?`.
    *   `ScoreCallOutputSchema`: Structured object (transcript, transcriptAccuracy, overallScore (0-5), callCategorisation, metricScores array [{metric, score, feedback}], summary, strengths, areasForImprovement).
    *   `scoreCallFlow`:
        *   **Step 1: Transcription (Internal):** Calls `transcribeAudio({ audioDataUri })`.
            *   **Critical Error Handling:** If transcription fails, returns specific error structure in `ScoreCallOutput` (transcript is error msg, score 0, etc.). *Does not proceed to scoring.*
        *   **Step 2: Scoring (If Transcription OK):**
            *   Prepares `ScoreCallPromptInputSchema` (transcript, product, agentName).
            *   Calls `scoreCallPrompt`. If prompt errors, populates `ScoreCallOutput` with scoring errors but retains successful transcript.
            *   Combines scoring output with transcript details for final `ScoreCallOutput`.
    *   `scoreCallPrompt`:
        *   Input: `ScoreCallPromptInputSchema`. Output: `ScoreCallPromptOutputSchema` (scoring fields only).
        *   AI Persona: Expert call quality analyst.
        *   Analyzes `{{{transcript}}}` for `{{{product}}}`.
        *   Evaluates metrics: Opening, Needs Discovery, Product Presentation, Objection Handling, Closing, Clarity, Agent Tone, User Sentiment, Product Knowledge.
        *   Requires scores (1-5), categorization, feedback per metric, summary, strengths, improvements.
        *   Model: `googleai/gemini-2.0-flash`. `temperature: 0.2`.
4.  **UI Display:** `CallScoringResultsCard` or `CallScoringResultsTable` show detailed analysis.

---

### **5. Knowledge Base Management**

**Purpose & Overview:**
Manages documents and text entries that serve as contextual knowledge for AI features.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/knowledge-base/page.tsx`.
*   **Frontend Form:** `/src/components/features/knowledge-base/knowledge-base-form.tsx` (add files/text).
*   **Frontend Table:** `/src/components/features/knowledge-base/knowledge-base-table.tsx` (display, view, delete).
*   **AI/Genkit:** N/A (Data management for AI, not direct AI generation).
*   **Client-Side Storage:** `useKnowledgeBase` hook (`/src/hooks/use-knowledge-base.ts`) using browser Local Storage (`KNOWLEDGE_BASE_KEY`).

**User Input Fields & Options (`knowledge-base-form.tsx`):**
1.  **Associated Product:** (Optional) `Select`. Options: "ET", "TOI".
2.  **Target Persona/Cohort:** (Optional) `Select`. Options from `CUSTOMER_COHORTS`.
3.  **Entry Type:** (Required) `RadioGroup`. Options: "Upload File(s)", "Add Text/Prompt".
4.  **If "Upload File(s)":** `Input type="file"` (multiple). PDF, DOCX, CSV, TXT, audio, PPT, XLS. Max 50MB/file.
5.  **If "Add Text/Prompt":**
    *   **Name/Title:** (Required) `Input type="text"`. Min 3 chars.
    *   **Text Content:** (Required) `Textarea`. Min 10 chars.

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User adds entries (file/text), views/manages in table, exports, clears.
2.  **Frontend Logic (`page.tsx`, `form.tsx`, `table.tsx`):**
    *   `KnowledgeBaseForm` uses `react-hook-form`, Zod validation. Calls submit handlers in `page.tsx`.
    *   `page.tsx` uses `useKnowledgeBase` hook (provides `files`, `addFile`, `addFilesBatch`, `deleteFile`, `setFiles`).
    *   `handleAddSingleEntry`/`handleAddMultipleFiles`: Create `KnowledgeFile` objects, call hook's add functions.
    *   `handleDeleteFile`: Calls `deleteFile`. `handleExportCsv`: Formats `files`, uses `exportToCsv`. `handleClearAllKnowledgeBase`: Calls `setFiles([])`. `handleDownloadFullPrompts`: Downloads static `ALL_PROMPTS_TEXT`.
    *   `KnowledgeBaseTable`: Displays `files` from hook.
    *   **System Default Entries (`useKnowledgeBase` hook):** `useEffect` ensures two comprehensive text entries (ET Prime, TOI Plus details - `ET_PRIME_COMPREHENSIVE_DETAILS`, `TOI_PLUS_COMPREHENSIVE_DETAILS`) are always present/updated in KB. User files preserved.
3.  **KB Interaction:** All operations via `useKnowledgeBase` hook directly with Local Storage.
4.  **Activity Logging (`useActivityLogger`):** Logs add, delete, clear, download prompts actions.

---

### **6. Training Material Creator**

**Purpose & Overview:**
Generates structured content outlines for training materials (PPT, Doc, PDF, Brochure) using various context sources.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/create-training-deck/page.tsx`.
*   **Genkit Flow:** `/src/ai/flows/training-deck-generator.ts` (Exports: `generateTrainingDeck` function, `GenerateTrainingDeckInput`, `GenerateTrainingDeckOutput`).
*   **AI Model:** `googleai/gemini-2.0-flash`.

**User Input Fields & Options (`create-training-deck/page.tsx`):**
1.  **Product:** (Required) `Select`. Options: "ET", "TOI".
2.  **Output Format:** (Required) `Select`. Options: "PDF", "Word Doc", "PPT", "Brochure".
3.  **Context Source (Choose ONE):**
    *   **Direct Prompt:** `Textarea`. Min 10 chars if chosen.
    *   **Directly Upload File(s):** `Input type="file"` (multiple). PDF, DOCX, TXT, etc. Max 10MB total. Text from small text files (<50KB) read client-side.
    *   **Select Files from Knowledge Base:** HTML `select multiple`. Lists `KnowledgeFile` entries from `useKnowledgeBase` (filtered by Product).
4.  **Generation Buttons:**
    *   "Generate from Provided Context": Uses the single chosen context source.
    *   "Generate from Entire KB for {Product}": Uses all KB entries for selected Product.

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User selects Product, Format, ONE context source. Clicks a generation button.
2.  **Frontend (`page.tsx`):**
    *   **Context Preparation (`handleGenerateMaterial`):**
        *   Based on active context source (Direct Prompt, Uploads, Selected KB, Entire KB), maps inputs to `FlowKnowledgeBaseItemSchema` array. For text files < 50KB or prompts, `textContent` is included.
        *   Sets `sourceDescriptionForAi` string.
    *   Assembles `GenerateTrainingDeckInput` (product, format hint, items, generateFromAllKb flag, sourceDescription).
    *   Calls `generateTrainingDeck` flow. Manages `isLoading`. Displays output. Provides Copy/Download. Logs activity.
3.  **Genkit Flow (`training-deck-generator.ts`):**
    *   `GenerateTrainingDeckInputSchema`: `product`, `deckFormatHint`, `knowledgeBaseItems` (array of `KnowledgeBaseItemSchemaInternal` {name, textContent?, isTextEntry, fileType?}), `generateFromAllKb`, `sourceDescriptionForAi`.
    *   `GenerateTrainingDeckOutputSchema`: `deckTitle`, `sections` (array of `ContentSectionSchema` {title, content, notes?}).
    *   `generateTrainingMaterialPrompt`:
        *   AI Persona: Presentation/doc specialist for `{{{product}}}`.
        *   Inputs: product, format, source desc, iterates `{{{knowledgeBaseItems}}}` (name, type, textContent excerpt).
        *   **Special Case Frameworks (Critical):**
            *   If inputs imply "ET Prime – Sales Training Deck": Uses predefined 3-slide framework (Title, What is ET Prime?, Key Benefits), fleshed out with context.
            *   If inputs imply "Telesales Data Analysis Framework": Uses predefined 9-section framework (Title, Objective, Data Sources, etc.), adapted for `{{{product}}}`.
        *   **General Case:** Synthesizes context into logical structure (min 3 sections).
        *   **Content Style:** Adapts to `{{{deckFormatHint}}}` (narrative/PDF, concise/PPT). Textual visual suggestions for PDF/Brochure.
        *   If context sparse, states and provides placeholder.
        *   Model: `googleai/gemini-2.0-flash`.
    *   `generateTrainingDeckFlow`: Calls prompt. Basic output validation. Handles errors.
4.  **UI Display:** Generated `deckTitle` and `sections` in an `Accordion`.

---

### **7. AI Data Analyst**

**Purpose & Overview:**
AI-powered analysis of user-described data files (Excel, CSV). Simulates data cleaning, interpretation, and analysis based on a **detailed user prompt** and **file metadata**, outputting a structured report. *Does not directly process binary content of large/complex files.*

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Page:** `/src/app/(main)/data-analysis/page.tsx`.
*   **Frontend Form:** `/src/components/features/data-analysis/data-analysis-form.tsx`.
*   **Frontend Display:** `/src/components/features/data-analysis/data-analysis-results-card.tsx`.
*   **Genkit Flow:** `/src/ai/flows/data-analyzer.ts` (Exports: `analyzeData` function, `DataAnalysisInput`, `DataAnalysisReportOutput`).
*   **AI Model:** `googleai/gemini-2.0-flash` (or higher tier due to complexity).

**User Input Fields & Options (`data-analysis-form.tsx`):**
1.  **"Upload" Context Files (Names & Types):** (Required) `Input type="file"` (multiple). Any type.
2.  **Your Specific Analysis Prompt & Data Description:** (Required) `Textarea`. Min 50, Max 10,000 chars.
    *   **Crucial Input:** User *must* describe files, likely structure (columns, data types, date formats, decoding rules), file mappings, analytical goals, known data messiness.

**Feature Creation Procedure & Data Flow (AI_TeleSuite):**
1.  **UI:** User "uploads" files (for name/type context), writes detailed prompt, clicks "Generate Analysis".
2.  **Frontend:**
    *   `DataAnalysisForm` collects files and prompt.
    *   `fileDetails` array (`{ fileName, fileType }`) created.
    *   If first file is CSV/TXT, small sample (`sampledFileContent`) read client-side.
    *   Assembles `DataAnalysisInput` (`{ fileDetails, userAnalysisPrompt, sampledFileContent? }`).
    *   Calls `analyzeData` flow. Manages `isLoading`. Displays report. Logs activity.
3.  **Genkit Flow (`data-analyzer.ts`):**
    *   `DataAnalysisInputSchema`: `fileDetails`, `userAnalysisPrompt`, `sampledFileContent?`.
    *   `DataAnalysisReportSchema`: Highly structured JSON (reportTitle, executiveSummary, keyMetrics array, detailedAnalysis object {dataReconstructionAndNormalizationSummary, smartTableRecognitionSummary, timeSeriesTrends, comparativePerformance, useCaseSpecificInsights}, chartsOrTablesSuggestions array?, recommendations array, directInsightsFromSampleText?, limitationsAndDisclaimer).
    *   `dataAnalysisReportPrompt`:
        *   AI Persona: Advanced Excel analyst AI (telesales).
        *   Inputs: `{{{fileDetails}}}`, `{{{userAnalysisPrompt}}}`, `{{{sampledFileContent}}}`.
        *   **Critical Simulated Analysis Instructions:**
            *   AI explicitly told analysis based **solely on user's text, file metadata, and text samples.**
            *   AI *acts as if* it performed: Data Reconstruction (Simulated Cleanup based on user's description of messiness), Table Normalization (Simulated), Smart Table Recognition (from user's description), KPI Calculation (from described fields and assumed clean data), Insight Generation.
            *   Strict adherence to `DataAnalysisReportSchema`. Mandatory disclaimer about not processing full binary files.
        *   Model: `googleai/gemini-2.0-flash` (or higher). `temperature: 0.3`.
    *   `dataAnalysisReportFlow`: Validates prompt length. Calls prompt. Ensures disclaimer. Handles AI errors.
4.  **UI Display:** `DataAnalysisResultsCard` renders structured report (accordions).

---

### **8. Dashboards (Activity, Transcription, Call Scoring, Training Material, Data Analysis)**

**Purpose & Overview:**
Provide historical views of activities and AI-generated outputs from various modules.

**Tech Stack & Key Components (AI_TeleSuite):**
*   **Frontend Pages:** e.g., `/src/app/(main)/activity-dashboard/page.tsx`, `/src/app/(main)/transcription-dashboard/page.tsx`, etc.
*   **Frontend Table Components:** e.g., `/src/components/features/activity-dashboard/activity-table.tsx`, `/src/components/features/transcription-dashboard/dashboard-table.tsx`, etc.
*   **AI/Genkit:** N/A (Dashboards display logged data, no new AI ops).
*   **Client-Side Storage:** `useActivityLogger` hook to retrieve logs from Local Storage.

**User Input Fields & Options (Example: Activity Dashboard):**
1.  **Date From/To:** (Optional) `DatePicker`.
2.  **Agent Name:** (Optional) `Input type="text"`.
3.  **Module:** (Optional) `Select` (dynamically populated from unique logged `module` values).
4.  **Product:** (Optional) `Select` ("All", "ET", "TOI").

**Feature Creation Procedure & Data Flow (General Pattern):**
1.  **UI:** User navigates to a dashboard. Activity Dashboard: applies filters. All: tables display items, "View" for details in dialog, "Export Options" (CSV, PDF, Text for Word).
2.  **Frontend Logic (Page Components):**
    *   Uses `useActivityLogger` to get `activities` array.
    *   `useEffect` sets `isClient` for Local Storage access.
    *   **Filtering (Activity Dashboard):** `ActivityDashboardFilters` component updates page's `filters` state. `useMemo` recalculates `filteredActivities`.
    *   **Data Transformation (Specific Dashboards):** Each dashboard page filters global `activities` by `module`, maps `activity.details` to specific historical item type for its table.
    *   **Sorting & Display:** Table components handle client-side sorting, rendering.
    *   **View Details:** Dialog shows details of `selectedItem`, often re-using feature's main display component (e.g., `CallScoringResultsCard`).
    *   **Export Logic:** Uses utility functions from `/src/lib/export.ts` and `/src/lib/pdf-utils.ts`.
3.  **Activity Logging:** Dashboards primarily consume logged data.

---

**General Application Structure & UI (AI_TeleSuite):**
*   **Sidebar Navigation:** Grouped as: Home, Sales Tools, Support Tools, Content & Call Processing, Analytics & Logs. Uses an Accordion component for groups.
*   **Styling:** Tailwind CSS with custom theme via `src/app/globals.css`.
*   **Error Handling:** `try...catch` in Genkit flows, client-side `toast` notifications for user feedback.
*   **File Utilities:** `/src/lib/file-utils.ts` (`fileToDataUrl`), `/src/lib/export.ts`, `/src/lib/pdf-utils.ts`.
*   **Responsiveness:** Designed for various screen sizes.

---
**Voice Agent Modules (Conceptual for Luvable to implement with its own capabilities):**

The AI_TeleSuite project includes concepts for:
*   **AI Voice Sales Agent:** Aims to automate sales calls. Configurable with product, cohort (Business Owners, Financial Analysts, Active Investors, Corporate Executives, Young Professionals, Students, Payment Dropoff, Paywall Dropoff, Plan Page Dropoff, Assisted Buying, Expired Users, New Prospect Outreach, Premium Upsell Candidates), ET plan configuration (1,2,3 year; 1,3,7 year plans), sales plan, offer, user/agent names, and a conceptual voice profile. Uses pitch generation, rebuttal assistance, and call scoring concepts.
*   **AI Voice Support Agent:** Aims to handle customer support queries via voice. Uses Knowledge Base for answers. Configurable with product, user/agent names, and a conceptual voice profile.

**For these two Voice Agent modules, Luvable should leverage its own existing voice call implementation, voice cloning technology, speech-to-text, text-to-speech, and real-time interaction capabilities if available. The AI_TeleSuite's current voice agent flows are text-based simulations of such interactions and should NOT be replicated directly if Luvable has superior, actual voice functionalities. The core AI logic (pitch content, rebuttal content, support answer generation) should still be driven by Genkit + Gemini as described for the other modules.**

---
This document outlines the features and technical implementation of AI_TeleSuite, providing a comprehensive guide for understanding or replicating its functionalities.

