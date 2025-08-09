# AI_TeleSuite: Product Brief for Tech & QC Teams

## Version History

**v1.0 (Current) - Stable Transcription & Scoring Baseline:**
- The Audio Transcription and AI Call Scoring features are now considered stable.
- Core logic for these features should not be changed without specific user instruction.
- This state can be referenced as the "v1.0 baseline" for future development.

---

## 1. Vision & Core Purpose

**Product Name:** AI_TeleSuite

**Vision:** To empower telesales and support teams with a suite of intelligent, AI-driven tools that enhance productivity, improve call quality, ensure consistency, and provide actionable insights from operational data.

**Core Problem We're Solving:** Telesales operations face challenges in agent training, maintaining pitch quality, handling objections effectively, analyzing call performance at scale, and leveraging unstructured data. AI_TeleSuite addresses these issues by automating content creation, simulating interactions, and providing deep, AI-powered analytics.

---

## 2. Core Technology Stack

This section is for the **Tech Team** to understand the foundational components and for the **QC Team** to understand the environment they are testing in.

- **Frontend:** Next.js 15.x (App Router) with React 18.x and TypeScript.
- **UI:** ShadCN UI components built on Radix UI and styled with Tailwind CSS.
- **AI Orchestration & Backend:** Genkit 1.x, running server-side within the Next.js environment. This is our single backend for all AI logic.
- **AI Models:** Google's Gemini models (`gemini-2.0-flash`, `gemini-1.5-flash-latest`) via the `@genkit-ai/googleai` plugin.
- **Client-Side State:** Primarily React Hooks (`useState`, `useEffect`). Custom hooks manage localStorage for user profile, activity logs, and the knowledge base.
- **Speech Synthesis (TTS):** **Simulated.** The `speech-synthesis-flow.ts` Genkit flow generates descriptive placeholders for audio URIs, not actual audio files. This is a key testing consideration for QC.
- **Local Storage:** The application is heavily reliant on the browser's `localStorage` for persisting user activity logs (`useActivityLogger`) and the knowledge base (`useKnowledgeBase`). QC should test application behavior with and without existing localStorage data and be aware that clearing browser data will reset these features.

---

## 3. Feature Breakdown for Tech & QC

### Feature 3.1: AI Pitch Generator

- **Purpose:** To generate a complete, structured sales pitch for a specific product and customer type.
- **Tech Logic (`pitch-generator.ts`):**
    - Takes `product`, `customerCohort`, and optional details as input.
    - Crucially, it receives a `knowledgeBaseContext` string. This context is prepared on the frontend (`pitch-generator/page.tsx`) by combining general KB entries with the content of any directly uploaded file. **The direct file's context is prepended and marked as the primary source for the AI.**
    - The `generatePitchFlow` uses `gemini-1.5-flash-latest` with a detailed prompt instructing it to adhere strictly to the KB context.
    - The output is a structured JSON object (`GeneratePitchOutputSchema`) containing distinct parts of the pitch (intro, hook, benefits, CTA, full script, etc.).
- **QC Focus:**
    - **Test Inputs:** Vary product, cohort, and all optional fields.
    - **Test Context Source:**
        1.  Test with **no direct file**: AI should use only the general Knowledge Base content.
        2.  Test with a **direct text file upload**: Verify that the pitch content prioritizes and reflects the specifics from the uploaded file.
        3.  Test with **sparse/empty KB**: The AI should gracefully handle this by stating in the pitch sections that context is missing.
    - **Test Output:**
        - Ensure all fields in the `PitchCard` are populated and distinct (no repetition between sections).
        - Verify the `fullPitchScript` logically combines all the individual components.
        - Check that `notesForAgent` correctly identifies when an uploaded file's content couldn't be read (e.g., for a PDF).

### Feature 3.2: AI Rebuttal Generator

- **Purpose:** To provide agents with an immediate, context-aware rebuttal to a customer's objection.
- **Tech Logic (`rebuttal-generator.ts`):**
    - Takes `product` and the `objection` text as input.
    - The frontend (`rebuttal-generator/page.tsx`) prepares and passes the relevant `knowledgeBaseContext`.
    - The `generateRebuttalFlow` uses `gemini-2.0-flash` with a prompt that instructs the AI to analyze the objection and synthesize a response based **primarily on the KB content**.
    - It is instructed to follow an "Acknowledge, Bridge, Benefit, Clarify/Question" structure.
- **QC Focus:**
    - **Test Inputs:** Test a wide variety of common objections (price, timing, value, etc.).
    - **Test Context Source:**
        1.  Test with a **rich KB**: The rebuttal should clearly use specific facts/benefits from the KB.
        2.  Test with a **sparse KB**: The AI should generate a more general, conversational rebuttal and pivot to clarifying questions, without inventing product details.
    - **Test Output:** The generated `rebuttal` string should be logical, empathetic, and relevant to the objection.

### Feature 3.3: Audio Transcription & Call Scoring (Core Processing Duo)

#### 3.3.1: Audio Transcription
- **Purpose:** To convert an audio file into a structured, diarized text transcript. This is a foundational service for other features.
- **Tech Logic (`transcription-flow.ts`):**
    - Takes an `audioDataUri` as input.
    - The `transcriptionFlow` uses `gemini-2.0-flash` (a multimodal model capable of audio processing).
    - The prompt is highly detailed, with strict rules for:
        - **Diarization:** Using speaker labels `AGENT:`, `USER:`, and `RINGING:` (for IVR/pre-agent sounds) in ALL CAPS.
        - **Time Allotments:** Outputting time ranges like `[0 seconds - 15 seconds]` for each segment.
        - **Language:** Output is **English (Roman script) ONLY**. Hinglish must be transliterated (e.g., "kya"), not translated. No Devanagari script.
    - Output is a JSON object with `diarizedTranscript` and an AI-assessed `accuracyAssessment`.
- **QC Focus:**
    - **Test Inputs:** Use various audio files (MP3, WAV) of different lengths and qualities (clear, noisy, overlapping speakers).
    - **Test Output:**
        - Verify the output format strictly matches the rules (time allotments, ALL CAPS labels).
        - Check for correct transliteration of any Hinglish words.
        - Assess if the AI's `accuracyAssessment` ("High", "Medium", "Low") reasonably matches the audio quality.

#### 3.3.2: AI Call Scoring
- **Purpose:** To analyze a call transcript and provide a detailed performance report.
- **Tech Logic (`call-scoring.ts`):**
    - **Internal Dependency:** This flow **first calls `transcribeAudio`** to get the transcript. A failure in transcription will abort the scoring process.
    - If transcription is successful, the `scoreCallFlow` calls `gemini-2.0-flash` again, this time with the transcript text and product context.
    - The prompt instructs the AI to act as a quality analyst, scoring against predefined metrics (Rapport, Discovery, Closing, etc.).
    - Output is a comprehensive `ScoreCallOutput` JSON object containing the transcript, scores, summary, strengths, and areas for improvement.
- **QC Focus:**
    - **Test Inputs:** Use various call audio files that demonstrate good, average, and poor sales techniques. Test for both "ET" and "TOI" products to ensure context is used.
    - **Test Failure Modes:**
        1.  Use a corrupted/unsupported audio file: The flow should return a structured error message indicating transcription failed, with an overall score of 0.
    - **Test Output:**
        - Check that the `CallScoringResultsCard` displays all sections correctly in the tabbed interface.
        - The `overallScore`, `callCategorisation`, and individual `metricScores` should be logically consistent.

### Feature 3.4: Training Material & Data Analysis (Advanced Content Generation)

#### 3.4.1: Training Material Creator
- **Purpose:** To generate structured text content for training decks, brochures, etc., based on various sources.
- **Tech Logic (`training-deck-generator.ts`):**
    - This is a flexible content generation tool. The user provides context via one of three methods: a direct text prompt, uploaded files, or selecting items from the Knowledge Base.
    - The frontend (`create-training-deck/page.tsx`) packages this context into a `knowledgeBaseItems` array for the flow.
    - The flow uses `gemini-2.0-flash` with a prompt that contains **two special-case frameworks**: one for an "ET Prime – Sales Training Deck" and another for a "Telesales Data Analysis Framework". If the user's request matches these, the AI is instructed to use a predefined structure. Otherwise, it performs a general synthesis.
- **QC Focus:**
    - **Test Special Cases:**
        1.  Request an "ET Prime sales training deck" for the "ET" product. Verify the output follows the specific 3-slide framework defined in the prompt.
        2.  Request a "Telesales Data Analysis Framework". Verify the output follows the 9-section framework.
    - **Test General Case:** Provide various KB items or a direct prompt and check if the generated content is logical and well-structured.
    - **Test Output:** The generated `deckTitle` and `sections` should be displayed correctly in the accordion view on the results page.

#### 3.4.2: AI Data Analyst
- **Purpose:** To **simulate** the analysis of telecalling data based on a user's detailed description of their data files.
- **Tech Logic (`data-analyzer.ts`):**
    - This feature **does not read the content of uploaded Excel/binary files**. This is a critical point.
    - It takes file metadata (name, type), an optional small text sample (from CSV/TXT), and a **highly detailed user prompt** describing the data's structure, decoding rules, and analytical goals.
    - The `dataAnalysisReportFlow` uses `gemini-2.0-flash` with an extensive prompt instructing it to act as an analyst *simulating* data cleaning and KPI calculation based *only* on the user's text description.
- **QC Focus:**
    - **Test Inputs:**
        - Provide a very detailed prompt describing hypothetical messy data and clear goals. The AI's output should reflect that it "understood" and "cleaned" this data, and the analysis should align with the stated goals.
        - Provide a vague prompt. The AI should produce a more generic report and state that its analysis is limited by the lack of detail.
        - Provide a CSV/TXT file with a prompt. The report should include the `directInsightsFromSampleText` section.
    - **Test Output:**
        - **Crucially, verify the `limitationsAndDisclaimer` is always present** and clearly states that the analysis is a simulation based on the user's description.

### Feature 3.5: AI Voice Agents (Simulated Interactions)

- **Purpose:** To orchestrate a simulated, turn-by-turn conversation for sales or support scenarios.
- **Tech Logic (`voice-sales-agent-flow.ts`, `voice-support-agent-flow.ts`):**
    - These are the most complex flows, acting as orchestrators.
    - They maintain conversation history and call other flows internally (`generatePitch`, `generateRebuttal`, `scoreCall`, `synthesizeSpeech`).
    - **User input is text-based.**
    - The `synthesizeSpeech` flow is **simulated**, returning a descriptive placeholder, not real audio.
- **QC Focus:**
    - **Test State Machine:**
        - **Sales Agent:** Start a conversation -> provide user responses -> trigger a rebuttal -> end the call. Verify the `nextExpectedAction` and conversation flow are logical.
        - **Support Agent:** Ask a query that can be answered by the KB. Ask a query that requires "live data" (verify escalation is suggested). Ask a query not in the KB (verify escalation is suggested).
    - **Test Error Handling:** Test what happens if the initial pitch generation fails in the sales agent flow. The agent should handle it gracefully.
    - **Test Final Output:** For the sales agent, verify that after ending the call, the `CallScoringResultsCard` is displayed with a score based on the simulated transcript.

### Feature 3.6: Dashboards & Activity Logging

- **Purpose:** To provide a historical view of all activities performed within the application.
- **Tech Logic:**
    - The `useActivityLogger` hook is the central mechanism. It captures `ActivityLogEntry` objects and saves them to browser `localStorage` (capped at `MAX_ACTIVITIES_TO_STORE` entries).
    - Each dashboard page (`/src/app/(main)/...-dashboard/page.tsx`) is a **client-side component** that:
        1.  Reads all activities from `localStorage` via the hook.
        2.  Filters the activities based on the dashboard's specific `module` (e.g., "Call Scoring").
        3.  Displays the filtered data in a table.
        4.  Uses a consistent "View Details" logic: clicking a button stores the selected `ActivityLogEntry` in a React state variable and opens a `Dialog` component, which then renders the details using a dedicated component (e.g., `CallScoringResultsCard`, `PitchCard`).
- **QC Focus:**
    - **Data Persistence:** Perform an action (e.g., generate a pitch), then navigate to the Activity Dashboard. Verify the entry is there. Refresh the page and verify the entry persists.
    - **Filtering:** On the main Activity Dashboard, test all filters (Date Range, Agent, Module, Product) and verify the table updates correctly.
    - **View Details:** For each dashboard, click the "View" / "Report" button and ensure the dialog opens with the correct, fully-detailed information for that specific entry.
    - **Export:** Test the "Export as CSV/PDF/DOC" functionality on each dashboard. Verify the downloaded file contains the currently filtered data.
    - **Storage Limit:** While hard to test precisely, be aware that only the most recent 50 activities are stored.

This brief should provide a solid foundation for both developing and testing the AI_TeleSuite application. Let's ensure we deliver a high-quality, robust, and intelligent product.
