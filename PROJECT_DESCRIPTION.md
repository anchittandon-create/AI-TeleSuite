
# AI_TeleSuite: AI Stack & Logic for Transcription and Call Scoring

This document details the AI stack, logic, and implementation for the Audio Transcription and AI Call Scoring features of the AI_TeleSuite application. This is intended as a guide for replication.

## Core AI Technology Stack

*   **AI Orchestration & Backend Logic:** Genkit (v1.x), primarily using the `@genkit-ai/googleai` plugin. Genkit flows run within the Next.js server-side environment.
*   **AI Models:** Google's Gemini models (specifically `gemini-2.0-flash` or similar, as configured within the Genkit flows) are used for both transcription and the analytical part of call scoring.
*   **Language:** TypeScript.

---

## Feature: Audio Transcription

**Purpose & Overview:**
Converts uploaded audio files to text with speaker diarization, time allotments, accuracy assessment, and strict English (Roman script) output.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/transcription-flow.ts` (Exports: `transcribeAudio` function, `TranscriptionInput` Zod schema, `TranscriptionOutput` Zod schema).
*   **Frontend (Conceptual for Replication):** `/src/app/(main)/transcription/page.tsx` would handle uploads, call the flow, and display results.

---

### Audio Transcription: AI Stack & Logic Implementation

1.  **Input to the Flow (`TranscriptionInput`):**
    *   `audioDataUri`: A string representing the audio file as a Base64 encoded Data URI (e.g., `data:audio/mp3;base64,...`). The frontend is responsible for converting the uploaded `File` object into this format.

2.  **Genkit Flow Execution (`transcribeAudio` function in `transcription-flow.ts`):**
    *   The `transcribeAudio` function is the primary entry point called by the frontend.
    *   It wraps the `transcriptionFlow` (defined using `ai.defineFlow`).

3.  **Core AI Call within `transcriptionFlow`:**
    *   The flow uses `ai.generate()` from the global Genkit `ai` instance.
    *   **Model:** `googleai/gemini-2.0-flash` (or a similar audio-capable Gemini model available via the Google AI plugin).
    *   **Prompt Structure:** The prompt provided to `ai.generate()` is an array:
        ```typescript
        [
          { media: { url: input.audioDataUri } }, // The audio data
          { text: transcriptionPromptInstructions } // Detailed text instructions
        ]
        ```
        Where `transcriptionPromptInstructions` is a lengthy string containing strict rules for the AI.
    *   **Key AI Instructions (`transcriptionPromptInstructions` - Summary):**
        *   **Time Allotment & Structure:** Output must be segmented. Each segment starts with a time range (e.g., `[0 seconds - 15 seconds]`) on a new line, followed by the speaker label and text on the next line.
        *   **Diarization Labels (ALL CAPS):**
            *   `RINGING:` For initial IVR/automated messages.
            *   `AGENT:` For the company representative.
            *   `USER:` For the customer.
            *   `SPEAKER 1/2:` As a fallback if roles are ambiguous, with instructions to switch to AGENT/USER if roles clarify.
        *   **Non-Speech Sounds:** To be noted in parentheses (e.g., `(Background Noise)`).
        *   **Language & Script (CRITICAL):** Output **MUST** be in English (Roman script) only. Hindi/Hinglish words **MUST** be transliterated (e.g., "kya" not "क्या"). No Devanagari.
        *   **Accuracy Assessment:** The AI self-assesses transcription accuracy as "High", "Medium" (with reasons), or "Low" (with reasons).
        *   **Completeness:** The AI must provide the full transcript.
    *   **Output Configuration for `ai.generate()`:**
        ```typescript
        output: { schema: TranscriptionOutputSchema, format: "json" },
        config: {
          temperature: 0.1, // Low temperature for factual transcription
          responseModalities: ['TEXT'], // Expecting only text output from this model for transcription task
        }
        ```
        `TranscriptionOutputSchema` (Zod schema) defines the expected JSON structure:
        *   `diarizedTranscript: z.string()`
        *   `accuracyAssessment: z.string()`

4.  **Output from the Flow (`TranscriptionOutput`):**
    *   An object matching `TranscriptionOutputSchema`, containing the `diarizedTranscript` and the AI's `accuracyAssessment`.
    *   Error Handling: If `ai.generate()` fails (e.g., API error, model issue, invalid audioDataUri), the flow catches the error and returns a `TranscriptionOutput` object where `diarizedTranscript` contains an error message (e.g., `[Transcription Error: ...]`) and `accuracyAssessment` is "Error".

5.  **Frontend Integration (Conceptual):**
    *   The frontend page (`/src/app/(main)/transcription/page.tsx`) allows users to select one or more audio files.
    *   It validates file type and size client-side.
    *   For each valid file, it uses a utility (like `fileToDataUrl` from `/src/lib/file-utils.ts`) to convert the `File` object to an `audioDataUri`.
    *   It then calls the exported `transcribeAudio(input)` function from the Genkit flow.
    *   It manages loading states and displays the `diarizedTranscript` and `accuracyAssessment` from the returned `TranscriptionOutput`. If multiple files, results are typically shown in a table.

---

## Feature: AI Call Scoring

**Purpose & Overview:**
Analyzes call transcripts (derived from uploaded audio) for sales performance metrics, providing scores and feedback relevant to a specific product.

**Relevant Files:**
*   **Genkit Flow:** `/src/ai/flows/call-scoring.ts` (Exports: `scoreCall` function, `ScoreCallInput` Zod schema, `ScoreCallOutput` Zod schema).
*   **Dependency:** Internally uses `transcribeAudio` from `/src/ai/flows/transcription-flow.ts`.
*   **Frontend (Conceptual for Replication):** `/src/app/(main)/call-scoring/page.tsx` would handle uploads, product selection, call the flow, and display the detailed scoring report.

---

### AI Call Scoring: AI Stack & Logic Implementation

1.  **Input to the Flow (`ScoreCallInput`):**
    *   `audioDataUri`: A string representing the audio file of the call recording (Base64 Data URI).
    *   `product`: The product ("ET" or "TOI") the call is about. This is crucial context for the scoring AI.
    *   `agentName` (optional): The name of the sales agent, for personalization in the report.

2.  **Genkit Flow Execution (`scoreCall` function in `src/ai/flows/call-scoring.ts`):**
    *   The `scoreCall` function is the entry point called by the frontend.
    *   It wraps the `scoreCallFlow` (defined using `ai.defineFlow`).

3.  **Internal Logic of `scoreCallFlow` (Two-Step Process):**

    *   **Step 1: Transcription (Internal Call)**
        *   The `scoreCallFlow` first calls the `transcribeAudio({ audioDataUri: input.audioDataUri })` function from `/src/ai/flows/transcription-flow.ts`.
        *   **Critical Error Handling (Transcription):**
            *   If the `transcribeAudio` call itself throws a system-level error, the `scoreCallFlow` catches this and returns a `ScoreCallOutput` object indicating a "Transcription service call failed" error.
            *   If `transcribeAudio` returns a result where `accuracyAssessment` is "Error" or the `diarizedTranscript` itself contains an error message (e.g., starts with "[Transcription Error...]"), the `scoreCallFlow` identifies this as a transcription failure.
            *   In case of transcription failure, the `scoreCallFlow` **does not proceed to the scoring step**. It returns a `ScoreCallOutput` object populated with the error transcript, an overall score of 0, and an "Error" categorization, with feedback indicating the scoring was aborted due to transcription failure.

    *   **Step 2: Scoring (If Transcription Succeeded)**
        *   If transcription was successful (i.e., a valid transcript was obtained), the flow proceeds to the scoring phase.
        *   **Core AI Call for Scoring:** The flow uses `ai.generate()` from the global Genkit `ai` instance.
            *   **Model:** `googleai/gemini-2.0-flash` (or a similar analytical Gemini model).
            *   **Prompt Construction:** A detailed prompt string is constructed dynamically, including:
                *   An instruction to act as an "expert call quality analyst."
                *   The `product` context (`Analyze the provided call transcript for a sales call regarding '${input.product}'.`).
                *   The `agentName` if provided.
                *   The full `diarizedTranscript` obtained from Step 1.
                *   **Key AI Instructions for Scoring (Summary):**
                    *   Evaluate the call against a predefined list of metrics: Opening & Rapport Building, Needs Discovery, Product Presentation (relevance to the specified `product`), Objection Handling, Closing Effectiveness, Clarity & Communication, Agent's Tone & Professionalism, User's Perceived Sentiment, Product Knowledge (specific to `product`).
                    *   Provide an overall score (1-5).
                    *   Provide a categorization (e.g., "Very Good", "Good", "Average", "Bad", "Very Bad").
                    *   For each metric, provide a score (1-5) and detailed feedback, referencing transcript parts if possible. Agent's Tone and User's Sentiment must be distinct metrics.
                    *   Provide a concise call summary, 2-3 key strengths, and 2-3 actionable areas for improvement.
                    *   Maintain objectivity.
            *   **Output Configuration for `ai.generate()`:**
                ```typescript
                output: { schema: ScoreCallGenerationOutputSchema, format: "json" },
                config: { temperature: 0.2 } // Low temperature for consistent, objective scoring
                ```
                `ScoreCallGenerationOutputSchema` is a Zod schema that is a subset of the full `ScoreCallOutputSchema` (it omits `transcript` and `transcriptAccuracy` because these are inputs to this specific AI call, not outputs *from* it).
        *   **Combining Results:** The output from this `ai.generate()` call (the scoring details) is combined with the `diarizedTranscript` and `transcriptAccuracy` from Step 1 to form the final `ScoreCallOutput` object.
        *   **Error Handling (Scoring AI Call):** If the `ai.generate()` call for scoring fails, the flow catches the error. It returns a `ScoreCallOutput` object that includes the successful transcript (from Step 1) but indicates an error in the scoring part (e.g., overall score 0, categorization "Error", and feedback noting the AI scoring model failed).

4.  **Output from the Flow (`ScoreCallOutput`):**
    *   A comprehensive object matching `ScoreCallOutputSchema`, including:
        *   `transcript: z.string()`
        *   `transcriptAccuracy: z.string()`
        *   `overallScore: z.number().min(0).max(5)`
        *   `callCategorisation: z.enum(CALL_SCORE_CATEGORIES)`
        *   `metricScores: z.array(MetricScoreSchema)` (where `MetricScoreSchema` has `metric`, `score`, `feedback`)
        *   `summary: z.string()`
        *   `strengths: z.array(z.string())`
        *   `areasForImprovement: z.array(z.string())`
    *   If any step (transcription or scoring) had a critical failure, the relevant fields in the output will reflect this error state.

5.  **Frontend Integration (Conceptual):**
    *   The frontend page (`/src/app/(main)/call-scoring/page.tsx`) allows users to:
        *   Select the `Product Focus` (ET or TOI).
        *   Upload one or more audio files.
        *   Optionally enter an `Agent Name`.
    *   For each audio file, it converts it to an `audioDataUri`.
    *   It then calls the exported `scoreCall(input)` function from the Genkit flow.
    *   It manages loading states (potentially showing progress for multiple files).
    *   It displays the detailed `ScoreCallOutput` in a structured format (e.g., using `CallScoringResultsCard.tsx` for single results or `CallScoringResultsTable.tsx` for multiple).

This explanation should provide Luvable AI with a clear understanding of the AI stack and the step-by-step logic involved in the Transcription and Call Scoring features of AI_TeleSuite.

  