
You are a top-tier AI coding agent. Your task is to build a complete, production-ready web application from scratch based on the detailed technical specifications below. The application is an "AI_TeleSuite" designed to empower telesales and support teams. Adhere strictly to the versions, libraries, folder structures, and logic flows described.

---

### **Version: v1.1 - Resilient Voice Agents & UX Polish**

This document describes the v1.1 state of the application. Key improvements over v1.0 include: a resilient, client-side TTS implementation, more robust AI flows with fallbacks, hardened voice agent logic for reliable turn-taking and barge-in, and significant UI/UX enhancements across all features.

---

### **1. Core Technology Stack**

*   **Framework:** Next.js (v15.x or latest stable) using the App Router.
*   **Language:** TypeScript.
*   **UI Library:** React (v18.x) with ShadCN UI components. All components are pre-built and available under `@/components/ui`.
*   **Styling:** Tailwind CSS. The specific theme and colors are defined in `src/app/globals.css`.
*   **AI Backend & Orchestration:** Genkit (v1.x) using `@genkit-ai/googleai`. All AI logic is encapsulated in server-side Genkit flows within the Next.js application.
*   **AI Models:** Google's Gemini models, specifically `gemini-2.0-flash` for most tasks and `gemini-1.5-flash-latest` for more complex reasoning or larger context windows.
*   **Client-Side State Management:** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). Custom hooks are used for managing `localStorage`.
*   **Text-to-Speech (TTS):** A **client-side utility** (`/src/lib/tts-client.ts`) that directly calls the Google Cloud Text-to-Speech REST API. The API key must be exposed to the client as `NEXT_PUBLIC_GOOGLE_API_KEY`.
*   **Speech-to-Text (ASR):** Browser's native `window.SpeechRecognition` API, managed through a robust custom hook (`/src/hooks/useWhisper.ts`).

---

### **2. Core Project Files & Configuration**

*   **`package.json`**: (Refer to the file content provided in the context)
*   **`tailwind.config.ts`**: Standard configuration for a ShadCN UI project.
*   **`src/app/globals.css`**: Defines the application's color scheme using CSS variables. (Refer to file content)
*   **Environment Variables (`.env`)**: Requires a Google API key. The key must be duplicated and prefixed with `NEXT_PUBLIC_` for client-side TTS access.
    ```
    GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_enabled
    NEXT_PUBLIC_GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_enabled
    ```

---

### **3. Folder & File Structure**

(Refer to the detailed folder structure provided in the context)

---

### **4. UI Design & Layout Structure**

*   **Main Layout (`src/app/(main)/layout.tsx`)**: The core layout for the authenticated app. It includes the `<AppSidebar>` on the left and renders page content within a `<SidebarInset>` component. A page loading overlay is displayed during navigation.
*   **Sidebar (`src/components/layout/app-sidebar.tsx`)**: A collapsible sidebar with accordion-style navigation groups. It's defined by a static `navStructure` array. It shows the current user profile. The navigation structure MUST place each dashboard link directly *after* its corresponding feature link.
*   **Page Header (`src/components/layout/page-header.tsx`)**: A sticky header displaying the page title and a hamburger menu trigger on mobile.
*   **Component-Based Design**: Each feature has its own folder in `src/components/features/`. These folders contain the main form, results display components (`PitchCard`, `CallScoringResultsCard`), and dashboard-specific tables.

---

### **5. Feature Implementation Details (Line-by-Line)**

This section provides a detailed breakdown of every feature in the application, covering its purpose, implementation, and core logic.

#### **5.1. Products (`/products`)**

*   **Purpose:** Manage the product catalog used across the application for contextual AI generation.
*   **Frontend:** `src/app/(main)/products/page.tsx`
*   **State Management:** `src/hooks/useProductContext.tsx`
*   **Logic:**
    1.  The `ProductProvider` wraps the root layout, managing an array of `ProductObject` items in `localStorage`.
    2.  The `ProductsPage` displays these products in a table. It provides UI to add new products, edit existing ones, and delete custom products (defaults are protected).
    3.  **AI Integration:** A "Generate with AI" button in the add/edit dialog calls the `generateProductDescription` Genkit flow. This flow takes a `productName` and `brandName` and uses a simple prompt with `gemini-2.0-flash` to generate a concise, one-sentence description, which is then populated back into the form.

#### **5.2. Knowledge Base (`/knowledge-base`)**

*   **Purpose:** A central repository for all contextual documents and text snippets (e.g., product descriptions, pricing sheets, sales scripts).
*   **Frontend:** `src/app/(main)/knowledge-base/page.tsx`
*   **State Management:** `src/hooks/use-knowledge-base.ts`
*   **Logic:**
    1.  The `useKnowledgeBase` hook manages an array of `KnowledgeFile` objects in `localStorage`.
    2.  The `KnowledgeBaseForm` allows users to add entries either by uploading files or by pasting text directly.
    3.  For file uploads, the frontend reads the file's metadata (name, type, size). For text entries, it captures the content and a user-provided name.
    4.  All entries are associated with a `Product` and an optional `Category` (`Pitch`, `Pricing`, etc.), which is crucial for the AI flows to retrieve the correct context.
    5.  The `KnowledgeBaseTable` below the form lists all entries and allows users to view details or delete items. The "View" action opens a dialog that renders a preview of the content using libraries like `docx-preview` for DOCX and native browser elements for PDF, images, etc.

---

### **GROUP: Sales & Support Tools**

#### **5.3. AI Pitch Generator (`/pitch-generator`)**

*   **Purpose:** Generates structured, high-quality sales pitches tailored to a specific product and customer cohort.
*   **Frontend:** `src/app/(main)/pitch-generator/page.tsx`
*   **Backend Flow:** `src/ai/flows/pitch-generator.ts`
*   **Input Schema (`GeneratePitchInputSchema`):** `product`, `customerCohort`, `knowledgeBaseContext`, `brandUrl`, and other optional fields.
*   **Output Schema (`GeneratePitchOutputSchema`):** A structured object with fields like `pitchTitle`, `warmIntroduction`, `personalizedHook`, `productExplanation`, `fullPitchScript`, etc.
*   **Logic:**
    1.  The user selects a product, cohort, and other optional details on the `PitchForm`.
    2.  The frontend prepares the `knowledgeBaseContext` string. It gathers all `KnowledgeFile` entries for the selected product and formats them with clear headings (e.g., "--- PRODUCT DETAILS, FEATURES, & PRICING ---"). This structured context is critical for the AI.
    3.  The `generatePitch` server action is called, which internally executes the `generatePitchFlow`.
    4.  **AI Prompt:** The AI is instructed to act as a "world-class sales agent." The prompt is highly prescriptive, mandating that the AI use specific sections of the `knowledgeBaseContext` to populate specific fields in the output schema (e.g., use 'Pricing' documents for the `discountOrDealExplanation`). A critical instruction authorizes the AI to browse the provided `brandUrl` as a fallback if the KB is insufficient.
    5.  The structured output is then rendered on the client using the `PitchCard` component, which displays each part of the pitch in an organized manner.

#### **5.4. AI Rebuttal Assistant (`/rebuttal-generator`)**

*   **Purpose:** Provides real-time, contextual rebuttals to customer objections.
*   **Frontend:** `src/app/(main)/rebuttal-generator/page.tsx`
*   **Backend Flow:** `src/ai/flows/rebuttal-generator.ts`
*   **Logic:**
    1.  The user enters a customer objection and selects the relevant product.
    2.  The `generateRebuttal` Genkit flow is called with the objection and the prepared `knowledgeBaseContext` for that product.
    3.  **AI Prompt:** The AI is prompted to follow an "Acknowledge, Bridge, Benefit, Clarify/Question" (ABBC/Q) model and to ground its response strictly in the provided KB context or the `brandUrl`.
    4.  **Resilience:** This flow is designed for high availability. If the primary AI call fails for any reason (API error, content filter, etc.), a `generateFallbackRebuttal` function is immediately triggered. This non-AI function uses keyword matching to categorize the objection and generates a reasonable response from a set of high-quality templates, ensuring the user always gets a helpful result.

---

### **GROUP: Analysis & Reporting**

#### **5.5. Audio Transcription & Dashboard (`/transcription`, `/transcription-dashboard`)**

*   **Purpose:** Transcribes audio files and provides a dashboard to review historical transcriptions.
*   **Frontend:** `src/app/(main)/transcription/page.tsx` and `.../transcription-dashboard/page.tsx`
*   **Backend Flow:** `src/ai/flows/transcription-flow.ts`
*   **Logic:**
    1.  On the `/transcription` page, the user uploads one or more audio files.
    2.  The files are converted to `dataUri` strings and sent one by one to the `transcribeAudio` Genkit flow.
    3.  **AI Prompt:** The prompt is simplified for reliability, instructing the model to output JSON with two fields: `diarizedTranscript` and `accuracyAssessment`. It has strict rules to only use `AGENT:` and `USER:` labels, transliterate Hinglish, and include time allotments (`[0 seconds - 15 seconds]`).
    4.  **Resilience:** The flow employs a dual-model strategy. It first attempts transcription with `gemini-2.0-flash`. If that fails, it automatically retries with the more powerful `gemini-1.5-flash-latest`. This significantly increases the success rate for large or noisy files.
    5.  The results are displayed in the `TranscriptionResultsTable`. All successful transcriptions are logged via `useActivityLogger`.
    6.  The `/transcription-dashboard` page reads these logs and displays them in a table, allowing users to view the details of any past transcription.

#### **5.6. AI Call Scoring & Dashboard (`/call-scoring`, `/call-scoring-dashboard`)**

*   **Purpose:** Analyzes call transcripts against a detailed rubric to provide performance metrics and feedback.
*   **Frontend:** `src/app/(main)/call-scoring/page.tsx` and `.../call-scoring-dashboard/page.tsx`
*   **Backend Flow:** `src/ai/flows/call-scoring.ts`
*   **Logic:**
    1.  The frontend now orchestrates a **two-step process** for resilience. First, it calls `transcribeAudio`.
    2.  Upon receiving a successful transcript, it then calls the `scoreCall` flow, passing the transcript in the `transcriptOverride` field. This decouples transcription from scoring.
    3.  **AI Prompt:** The `scoreCall` prompt is extremely detailed, instructing the AI to act as a "world-class, exceptionally detailed telesales performance coach." It contains a rubric of over 75 metrics that the AI *must* score. It analyzes both the transcript for content and the (optional) audio for tonality.
    4.  **Resilience:** This flow also has a dual-model fallback. It first tries `gemini-1.5-flash-latest` for the deep analysis. If this fails (e.g., due to rate limits), it falls back to `gemini-2.0-flash` with a simpler, text-only rubric to ensure a score is always returned.
    5.  The comprehensive `ScoreCallOutput` is rendered in the `CallScoringResultsCard`.
    6.  The `/call-scoring-dashboard` reads all "Call Scoring" and "AI Voice Agent" activity logs to display a history of all scored calls, regardless of their source.

#### **5.7. Combined Call Analysis & Dashboard (`/combined-call-analysis`, `/combined-call-analysis-dashboard`)**

*   **Purpose:** Aggregates multiple call scoring reports to identify trends, common strengths, and weaknesses.
*   **Frontend:** `src/app/(main)/combined-call-analysis/page.tsx` and `.../combined-call-analysis-dashboard/page.tsx`
*   **Backend Flow:** `src/ai/flows/combined-call-scoring-analysis.ts`
*   **Logic:**
    1.  The UI has been redesigned for clarity. The user first selects a product.
    2.  A `ReportSelectionTable` component then appears, listing all historical scored calls for that product from the activity log. Users can select the reports they want to include using checkboxes.
    3.  When "Run Analysis" is clicked, the selected report data is sent to the `analyzeCallBatch` flow.
    4.  **AI Prompt:** The AI is instructed to act as a "call quality supervisor and data analyst," synthesizing the provided report summaries to calculate an average score and identify common themes, strengths, and areas for improvement.
    5.  **Pitch Optimization:** The results card includes a button to "Generate Optimized Pitches." This calls a second flow, `generateOptimizedPitches`, which takes the analysis summary from the first flow and passes it as `optimizationContext` to the main `generatePitch` flow, creating data-driven, improved sales scripts.
    6.  The `/combined-call-analysis-dashboard` shows a history of all previously run combined analyses.

---

### **GROUP: Voice Agents**

#### **5.8. AI Voice Sales & Support Agents (`/voice-sales-agent`, `/voice-support-agent`)**

*   **Purpose:** Orchestrates a full, simulated voice-to-voice conversation with a user.
*   **Frontend:** `src/app/(main)/voice-sales-agent/page.tsx` & `.../voice-support-agent/page.tsx`
*   **Backend Flows:** `.../voice-sales-agent-flow.ts` & `.../voice-support-agent-flow.ts`
*   **Logic & Reliability Mandates:**
    1.  **State Machine:** The frontend is a robust state machine managing states like `CONFIGURING`, `LISTENING`, `PROCESSING`, `AI_SPEAKING`, and `ENDED`.
    2.  **ASR/TTS:** It uses `useWhisper` for speech recognition and `synthesizeSpeechOnClient` for text-to-speech.
    3.  **Barge-in:** The `useWhisper` hook's `onTranscribe` (interim results) callback is used to implement barge-in. As soon as user speech is detected, it calls a function to immediately stop any ongoing TTS playback, ensuring a responsive interruption.
    4.  **Turn-taking vs. Inactivity:** These are now two separate, correctly implemented mechanisms.
        *   **Turn-taking:** `useWhisper` has a short `silenceTimeout` (50ms). When the user stops speaking for this duration, `onTranscriptionComplete` fires, triggering the agent's next turn immediately.
        *   **Inactivity:** A separate `inactivityTimeout` (3000ms) in the hook fires *only if no speech is detected at all* after the agent starts listening. This triggers a reminder turn from the agent.
    5.  **Routing (Sales Agent):** The `runVoiceSalesAgentTurn` flow now uses a fast, lightweight "router" prompt (`conversationRouterPrompt`) to first classify the user's intent (e.g., continue pitch, answer question, handle objection). It then calls smaller, specialized prompts to generate the actual response, ensuring speed and relevance.
    6.  **KB Grounding:** All response-generation prompts are strictly instructed to ground their answers in the provided Knowledge Base context.
    7.  **Post-Call:** When the call ends, a full transcript is constructed, and the `scoreCall` flow is `await`ed to ensure the final score is included in the activity log. A `PostCallReview` component displays all final artifacts (transcript, audio link, and score).

#### **5.9. Voice Agent Dashboards (`/voice-sales-dashboard`, `/voice-support-dashboard`)**

*   **Purpose:** To review logs of all past voice agent interactions.
*   **Frontend:** `.../voice-sales-dashboard/page.tsx` & `.../voice-support-dashboard/page.tsx`
*   **Logic:**
    1.  These pages query the activity log for entries from "AI Voice Sales Agent" and "AI Voice Support Agent".
    2.  They display a table of all interactions.
    3.  The "View Report" button opens a dialog that shows the full conversation transcript, a player for the full call audio (if generated), and the final call score report (if available).
    4.  Users can trigger a scoring analysis directly from the dashboard if one wasn't run automatically.

---

### **GROUP: Content & Data Tools**

#### **5.10. Training Material Creator & Dashboard (`/create-training-deck`, `/training-material-dashboard`)**

*   **Purpose:** Generates structured text content for training decks, brochures, etc.
*   **Frontend:** `src/app/(main)/create-training-deck/page.tsx`
*   **Backend Flow:** `src/ai/flows/training-deck-generator.ts`
*   **Logic:**
    1.  The user selects a product and output format. They can provide context in three ways: a direct text prompt, uploading files, or selecting items from the Knowledge Base.
    2.  The `generateTrainingDeck` flow is called. Its prompt has two special-cased frameworks: one for an "ET Prime Sales Deck" and another for a "Telesales Data Analysis Framework". If the user's request matches these, the AI uses the predefined structure. Otherwise, it performs a general synthesis of the provided context.
    3.  The output is a structured JSON object with a `deckTitle` and an array of `sections`, which is then rendered in an accordion on the frontend.
    4.  The `/training-material-dashboard` page lists all previously generated materials from the activity log.

#### **5.11. AI Data Analyst & Dashboard (`/data-analysis`, `/data-analysis-dashboard`)**

*   **Purpose:** Simulates a data analyst to provide insights from user-described data files.
*   **Frontend:** `src/app/(main)/data-analysis/page.tsx`
*   **Backend Flow:** `src/ai/flows/data-analyzer.ts`
*   **Logic:**
    1.  This feature works based on **simulation**. The user "uploads" files (only metadata like name/type is sent to the AI) and provides a very detailed `userAnalysisPrompt`.
    2.  In the prompt, the user must describe the files' contents, structure (columns, sheets), data decoding rules, and their analytical goals.
    3.  The `analyzeData` flow's prompt instructs the AI to act as an "advanced Excel analyst". It simulates data cleaning, KPI calculation, and insight generation based *only* on the user's textual description.
    4.  The output is a structured report that includes a **critical disclaimer** stating that the analysis is based on the user's description and not on the actual file content.
    5.  The `/data-analysis-dashboard` page lists all previously generated reports.

#### **5.12. Batch Audio Downloader (`/batch-audio-downloader`)**

*   **Purpose:** Downloads multiple audio files from a list of URLs and bundles them into a ZIP archive.
*   **Frontend:** `src/app/(main)/batch-audio-downloader/page.tsx`
*   **Logic:**
    1.  This is a purely **client-side** utility using the `jszip` and `xlsx` libraries.
    2.  The user can paste URLs or upload an Excel file. If Excel is used, the `xlsx` library parses it to extract the URLs.
    3.  The frontend then `fetch`es each audio file. An alert warns the user that success depends on the remote server's **CORS policy**.
    4.  Successfully fetched blobs are added to a `JSZip` instance, which then generates a ZIP file for the user to download.

---

### **GROUP: System**

#### **5.13. Global Activity Log (`/activity-dashboard`)**

*   **Purpose:** A master log of every significant user action across the entire application.
*   **Frontend:** `src/app/(main)/activity-dashboard/page.tsx`
*   **State Management:** `src/hooks/use-activity-logger.ts`
*   **Logic:**
    1.  The `useActivityLogger` hook provides functions (`logActivity`, `updateActivity`, etc.) that manage an array of `ActivityLogEntry` objects in `localStorage`.
    2.  The dashboard page fetches all activities and provides filters for date, agent name, module, and product.
    3.  The `ActivityTable` component renders the filtered logs. The "View Details" button for each entry opens a dialog that displays a rich, formatted view of the logged data, often reusing a feature's primary results card (e.g., `CallScoringResultsCard`, `PitchCard`).

#### **5.14. Clone Full App (`/clone-app`)**

*   **Purpose:** Provides the full source code and this replication prompt for recreating the application.
*   **Frontend:** `src/app/(main)/clone-app/page.tsx`
*   **Backend API Route:** `src/app/api/clone-app/route.ts`
*   **Logic:**
    1.  The frontend provides two main actions:
        *   A "Download Project ZIP" button that calls the `/api/clone-app` API route.
        *   A "Copy Replication Prompt" button that copies the content of this `REPLICATION_PROMPT.md` file to the clipboard.
    2.  The API route uses `JSZip` on the server side to read all the specified project files and directories (from a `pathsToInclude` array) and package them into a ZIP archive, which is then streamed back to the user for download.
