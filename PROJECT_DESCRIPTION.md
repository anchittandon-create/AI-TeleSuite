# AI_TeleSuite: Feature Deep Dive & Replication Guide (for Luvable Integration)

This document provides a detailed description of AI_TeleSuite's features (excluding Voice Agent modules) and guidance on how their underlying logic and AI interactions can be understood or replicated for integration with a platform like "Luvable."

## Core Philosophy: Knowledge Base Driven AI

A central principle in AI_TeleSuite is that the AI's performance is heavily reliant on the quality and relevance of information provided through the application's **Knowledge Base (KB)**. Effective "training" of these AI features primarily involves curating and maintaining a comprehensive KB.

---

## Module 1: AI Pitch Generator

**1.1. Overview:**
Generates tailored sales pitches for specific products (ETPrime or TOI+) aimed at defined customer cohorts, leveraging information from the Knowledge Base and user-provided parameters.

**1.2. Core Functionality:**
- User selects: Product, Customer Cohort.
- User can optionally provide: ET Plan Configuration (for ET product), Sales Plan, specific Offer details, Agent Name, Customer Name.
- User can optionally upload a "Direct Context File" (e.g., PDF, DOCX, TXT) which, if provided, becomes the primary source of information for the pitch.
- The system constructs a detailed `knowledgeBaseContext` string. This includes:
    - Explicit instructions if a direct file is uploaded (prioritizing its content).
    - Relevant entries from the general Knowledge Base filtered by the selected product.
- This context, along with user selections, is passed to a Genkit AI flow.
- The AI (Gemini model via Genkit) generates a structured pitch output including: pitch title, warm introduction, personalized hook, product explanation, key benefits/bundles, discount/deal explanation, objection handling previews, a full integrated pitch script, estimated duration, and agent notes.

**1.3. "Training Logic" / Replication Guide for Luvable:**

*   **Input Requirements for Luvable:**
    *   `product`: "ET" or "TOI".
    *   `customerCohort`: Selected from a predefined list (e.g., "Payment Dropoff", "Business Owners").
    *   `etPlanConfiguration` (optional): e.g., "1, 2 and 3 year plans".
    *   `salesPlan` (optional): e.g., "1-Year".
    *   `offer` (optional): Text string for specific offer.
    *   `agentName` (optional): Text string.
    *   `userName` (optional): Text string.
    *   `knowledgeBaseContext`: A rich text string containing all relevant product information, features, benefits, selling points, and potentially content from a user-uploaded file.

*   **Knowledge Base Dependency:**
    *   **Crucial for success.** The KB should contain:
        *   Detailed product features and their *customer benefits*.
        *   Target audience information or notes for different cohorts.
        *   Specifics about plans, pricing structures (even if placeholders like `<INSERT_PRICE>` are used in the pitch).
        *   Information on bundled offers (e.g., TimesPrime).
        *   Common selling themes, value propositions.
        *   If direct file upload is supported in Luvable, the system should clearly demarcate and prioritize this content within the `knowledgeBaseContext`.

*   **AI Prompt Structure & Key Instructions (Simplified for Gemini-like model):**
    *   **Role:** "You are a GenAI-powered telesales assistant trained to generate high-conversion sales pitches for {product}..."
    *   **Task:** "Generate a professional, persuasive telesales pitch... Adhere strictly to the output schema..."
    *   **Contextual Inputs (passed as variables/placeholders in prompt):** `product`, `customerCohort`, `salesPlan`, `offer`, `agentName`, `userName`, `etPlanConfiguration`.
    *   **Primary Data Source:** The `knowledgeBaseContext` string.
        *   **Critical Instruction:** "The 'Knowledge Base Context' provided is your *ONLY* source of truth for product features, benefits... DO NOT invent, assume, or infer any details NOT EXPLICITLY stated in the 'Knowledge Base Context'."
        *   **Handling Uploaded Files:** "If an 'UPLOADED FILE CONTEXT' section IS PRESENT... you MUST treat it as the ABSOLUTE PRIMARY SOURCE... If you cannot directly process... state this in 'notesForAgent' and use metadata/fallback KB content."
    *   **Output Structure Requirement:** The AI is instructed to populate *every field* of a defined output schema (see `GeneratePitchOutputSchema` in `src/ai/flows/pitch-generator.ts`). This schema includes fields like `pitchTitle`, `warmIntroduction`, `personalizedHook`, `productExplanation`, `keyBenefitsAndBundles`, `discountOrDealExplanation`, `objectionHandlingPreviews`, `finalCallToAction`, `fullPitchScript`, `estimatedDuration`, `notesForAgent`.
    *   **No Repetition:** "AVOID REPETITION: Ensure that each section of the pitch... brings NEW and DISTINCT information... Do not repeat the same points across different sections."
    *   **Handling Sparse KB:** "If the context... is limited for a specific section... you MUST briefly state in that pitch section what information would typically go there and suggest the agent refer to the full Knowledge Base or the source document..."
    *   **Tone:** Conversational, confident, respectful, helpful.

*   **Output Expectation (from AI):** A JSON object matching `GeneratePitchOutputSchema`. The most important field is `fullPitchScript`.

*   **Key Considerations for Replication in Luvable:**
    *   Luvable's AI needs to be capable of structured data generation (JSON output based on a schema).
    *   The prompt templating mechanism in Luvable should allow injection of all input variables and the comprehensive `knowledgeBaseContext`.
    *   The ability to process long context windows for the `knowledgeBaseContext` is essential.
    *   Strict adherence to "use only provided KB context" is key to factual pitches.

---

## Module 2: AI Rebuttal Assistant

**2.1. Overview:**
Provides contextual rebuttals to customer objections regarding ETPrime or TOI+ subscriptions, using information sourced exclusively from the Knowledge Base.

**2.2. Core Functionality:**
- User inputs: Customer's objection (text), Product (ET/TOI).
- The system constructs a `knowledgeBaseContext` string by fetching relevant entries from the general Knowledge Base for the selected product.
- This context and the user's objection are passed to a Genkit AI flow.
- The AI (Gemini model) generates a suggested rebuttal.

**2.3. "Training Logic" / Replication Guide for Luvable:**

*   **Input Requirements for Luvable:**
    *   `objection`: Text string of the customer's objection.
    *   `product`: "ET" or "TOI".
    *   `knowledgeBaseContext`: A text string containing relevant product information, common selling points, value propositions, and potentially pre-defined counters to common objections, all specific to the chosen `product`.

*   **Knowledge Base Dependency:**
    *   **Highly critical.** The KB should contain:
        *   Product features, benefits, and USPs (Unique Selling Propositions).
        *   Value propositions (e.g., "Value for Money", "Productivity Boost").
        *   Common customer concerns or objections and corresponding positive framing or counter-arguments.
        *   Details about pricing, plans, or offers that can be used to address cost-related objections.

*   **AI Prompt Structure & Key Instructions (Simplified):**
    *   **Role:** "You are a GenAI-powered telesales assistant trained to provide quick, convincing rebuttals for objections related to {product} subscriptions."
    *   **Task:** "Provide a professional, specific, and effective response to the customer's objection, leveraging the provided Knowledge Base."
    *   **Contextual Inputs:** `objection`, `product`, `knowledgeBaseContext`.
    *   **Primary Data Source:** `knowledgeBaseContext`.
        *   **Critical Instruction:** "Your rebuttal MUST be based *exclusively* on information found in the provided 'Knowledge Base Context'. Do NOT invent product information or make assumptions beyond the KB."
    *   **Rebuttal Strategy (ABBC/Q):** The AI is guided to:
        1.  Understand the core objection.
        2.  Prioritize KB content: Search for relevant facts/features/themes in the KB that directly address the objection.
        3.  Synthesize KB info: Transform KB points into a compelling argument, not just list facts.
        4.  Structure the rebuttal (Acknowledge, Bridge, Benefit from KB, Clarify/Question).
        5.  Handle sparse KB: If KB lacks a direct counter, acknowledge, pivot to a general strength (from KB if possible), and ask clarifying questions.
    *   **Tone:** Confident, helpful, professional, understanding.

*   **Output Expectation (from AI):** A JSON object with a `rebuttal` field containing the text of the suggested rebuttal. See `GenerateRebuttalOutputSchema` in `src/ai/flows/rebuttal-generator.ts`.

*   **Key Considerations for Replication in Luvable:**
    *   Luvable's AI must be good at nuanced language understanding to grasp the core of the objection.
    *   It needs to follow instructions to synthesize information from the KB rather than just extracting snippets.
    *   The ability to adhere to the "KB only" rule for factual claims is essential.

---

## Module 3: Audio Transcription

**3.1. Overview:**
Transcribes uploaded audio files into text, performs speaker diarization (identifying "Agent" and "User" or "Speaker 1/2"), segments the transcript with time allotments, and provides a qualitative accuracy assessment. It also handles transliteration of Hindi/Hinglish speech into Roman script.

**3.2. Core Functionality:**
- User uploads an audio file (various formats supported like MP3, WAV, M4A).
- The audio file is converted to a base64 data URI.
- This data URI is passed to a Genkit AI flow.
- The AI (Gemini model with audio input capabilities) processes the audio.
- The AI is instructed to produce:
    - A diarized transcript with speaker labels ("AGENT:", "USER:", "RINGING:", "SPEAKER 1:", etc.) and time segments (e.g., "[0 seconds - 15 seconds]").
    - Transliteration of any Hindi/Hinglish into Roman script (e.g., "aap kaise hain" not "आप कैसे हैं").
    - A qualitative accuracy assessment ("High", "Medium due to...", "Low due to...").

**3.3. "Training Logic" / Replication Guide for Luvable:**

*   **Input Requirements for Luvable:**
    *   `audioDataUri`: The audio file encoded as a data URI (e.g., `data:audio/mp3;base64,...`). Luvable's AI must support audio input in this or a comparable format.

*   **Knowledge Base Dependency:** None for this specific feature, beyond the AI's inherent training on language and speech.

*   **AI Prompt Structure & Key Instructions (Simplified for a multimodal AI like Gemini):**
    *   **Task:** "Transcribe the following audio with the **utmost accuracy and diligence**, strictly adhering to all instructions..."
    *   **Input:** The prompt includes a special placeholder for the audio data: `{{media url=audioDataUri}}`.
    *   **Output Schema Requirement:** The AI is given a strict output schema (`TranscriptionOutputSchema` in `src/ai/flows/transcription-flow.ts`) to follow, requiring `diarizedTranscript` and `accuracyAssessment`.
    *   **Diarization Rules (CRITICAL):**
        *   Specific instructions on labeling initial ringing/IVR as "RINGING:".
        *   Guidance on identifying "AGENT:" (e.g., based on introductory phrases, controlling conversation flow) and "USER:".
        *   Fallback to "SPEAKER 1:", "SPEAKER 2:" if roles are ambiguous, with an instruction to switch to AGENT/USER if roles become clear later.
        *   Labels must be IN ALL CAPS.
    *   **Time Allotment:** "Segment the audio into logical spoken chunks. For each chunk: On a new line, provide the time allotment... On the *next* line, provide the speaker label..."
    *   **Language & Script (CRITICAL & STRICT):** "The entire transcript MUST be in English (Roman script) ONLY. If Hindi or Hinglish words... are spoken... they MUST be accurately transliterated into Roman script... Absolutely NO Devanagari script... permitted."
    *   **Accuracy Assessment:** AI must provide "High", "Medium due to [reason]", or "Low due to [reason]" based on its confidence and perceived audio quality.
    *   **Completeness:** "Ensure the transcript is complete and full."

*   **Output Expectation (from AI):** A JSON object matching `TranscriptionOutputSchema`.

*   **Key Considerations for Replication in Luvable:**
    *   Luvable's AI **must** support audio file input and speech-to-text capabilities.
    *   It needs to be very good at speaker diarization based on contextual cues in the conversation.
    *   The ability to perform accurate transliteration from Hindi/Hinglish to Roman script is crucial.
    *   The AI must be able to follow complex formatting instructions for the transcript output (time segments on one line, speaker:text on the next).

---

## Module 4: AI Call Scoring

**4.1. Overview:**
Analyzes call transcripts (generated by the Audio Transcription module or provided directly) to provide an overall quality score, categorize call performance, and offer detailed feedback on various sales metrics.

**4.2. Core Functionality:**
- This module typically runs *after* a call has been transcribed.
- Input: Call transcript (text), Product context (ET/TOI), optional Agent Name.
- The AI (Gemini model) evaluates the transcript against a predefined set of sales metrics.
- Output includes: Overall score (0-5), call categorization (e.g., "Very Good", "Average", "Error"), metric-specific scores and feedback, a summary, strengths, and areas for improvement.

**4.3. "Training Logic" / Replication Guide for Luvable:**

*   **Input Requirements for Luvable:**
    *   `transcript`: Full text of the call transcript.
    *   `product`: "ET" or "TOI" (to provide context for product knowledge evaluation).
    *   `agentName` (optional): Name of the agent.

*   **Knowledge Base Dependency:** Indirect. While not directly fed the KB for scoring, the AI's evaluation of "Product Knowledge" as a metric relies on its general understanding of what good product knowledge for ET/TOI would look like, which it might have gained from other interactions or its base training. The prompt itself doesn't take the KB as a direct input for scoring.

*   **AI Prompt Structure & Key Instructions (Simplified):**
    *   **Role:** "You are an expert call quality analyst. Your task is to objectively and consistently score a sales call."
    *   **Task:** "Analyze the provided call transcript for a sales call regarding '{product}'... Based *strictly* on the transcript and product context, evaluate the call across these metrics..."
    *   **Contextual Inputs:** `transcript`, `product`, `agentName`.
    *   **Metrics for Evaluation (explicitly listed in the prompt):**
        - Opening & Rapport Building
        - Needs Discovery
        - Product Presentation (relevance to {product})
        - Objection Handling
        - Closing Effectiveness
        - Clarity & Communication
        - Agent's Tone & Professionalism (inferred from transcript)
        - User's Perceived Sentiment (inferred from transcript)
        - Product Knowledge (specific to {product}, as demonstrated in transcript)
    *   **Output Structure Requirement:** AI must provide an overall score (1-5), categorization, detailed scores and feedback for *each* listed metric, a summary, strengths, and areas for improvement, matching the `ScoreCallOutputSchema` (specifically, the `ScoreCallPromptOutputSchema` part, as the transcript itself is an input).
    *   **Objectivity:** "Be as objective as possible in your scoring."

*   **Output Expectation (from AI):** A JSON object matching `ScoreCallPromptOutputSchema` (which is `ScoreCallOutputSchema` minus `transcript` and `transcriptAccuracy`).

*   **Key Considerations for Replication in Luvable:**
    *   Luvable's AI needs to be adept at understanding conversational nuances from text to infer tone, sentiment, and effectiveness across various sales stages.
    *   The ability to provide structured, multi-faceted feedback (scores + text feedback per metric) is essential.
    *   A lower temperature setting for the AI model is recommended for more consistent and objective scoring.

---

## Module 5: Knowledge Base Management

**5.1. Overview:**
Allows users to upload documents (PDF, DOCX, TXT, CSV, audio, presentations, spreadsheets etc.) and create direct text entries that form the informational backbone for other AI features like Pitch Generation and Rebuttal Assistance. Entries can be associated with products (ET/TOI) and customer personas/cohorts.

**5.2. Core Functionality:**
- **File Uploads:** Users can upload various file types. The system stores the file's metadata (name, type, size, upload date) and user-provided associations (product, persona). Actual file content of large/binary files is *not* typically sent to the AI directly for general KB purposes; instead, the AI uses the file's name and metadata as context, or specific text entries derived from these files are used. For small, plain text files, the content might be directly incorporated into `knowledgeBaseContext` strings for features like Pitch Generator if the file is *explicitly chosen as direct context*.
- **Text Entries:** Users can create named text entries directly in the UI, associating them with products/personas. This content IS directly usable by the AI.
- **System Default Entries:** The system includes pre-defined, comprehensive text entries for ET Prime and TOI Plus product details, which serve as a baseline KB.
- **Data Storage:** All KB metadata and text entry content are stored persistently (in AI_TeleSuite, this is via browser localStorage; for Luvable, a database would be needed).

**5.3. "Training Logic" / Replication Guide for Luvable:**

*   **This module is primarily a data management system, not an AI generation feature itself. Its "training" involves understanding how to structure and populate it effectively for the AI modules that *consume* its content.**
*   **Data Structure for Luvable:**
    *   Each KB entry should have fields for: `id`, `name`, `type` (e.g., "file", "text_entry"), `mime_type` (if file), `size` (bytes or char count), `product_association` ("ET", "TOI", or null/All), `persona_association` (cohort string or null/All), `upload_date`, `textContent` (full text if it's a text entry or content extracted from a small text file), `isSystemDefault` (boolean).
*   **Content Strategy for Populating Luvable's KB:**
    *   **Pitch Generator:** Needs detailed product features, benefits, USPs, common selling themes, bundle information, pricing cues, cohort-specific pain points/motivators.
    *   **Rebuttal Assistant:** Needs common objections and strong counter-arguments, product strengths, value propositions.
    *   **Training Material Creator:** Any content that would be useful for training – product specs, sales techniques, market info, data analysis methods.
    *   **General Principle:** The more comprehensive, well-structured, and relevant the KB content, the better all other AI features will perform. Text entries are generally more directly usable by the AI than references to large binary files. If using file references, ensure file names are descriptive.

*   **How AI_TeleSuite AI Modules Use KB Content (for Luvable's reference):**
    *   When an AI feature (like Pitch Generator) runs, the application code queries its KB (localStorage in AI_TeleSuite) for entries matching the current context (e.g., selected product).
    *   The `textContent` of relevant text entries, and potentially contextual information derived from file metadata (like names of relevant files), are concatenated into a single large string (`knowledgeBaseContext`).
    *   This `knowledgeBaseContext` string is then passed to the AI model as part of its prompt.
    *   A special "UPLOADED FILE CONTEXT" block is prepended if a user explicitly uploads a file for *direct use* in a feature like Pitch Generator, signaling the AI to prioritize that.

---

## Module 6: Training Material Creator

**6.1. Overview:**
Generates structured content outlines for training decks or brochures based on selected Knowledge Base items, direct file uploads, or a direct user prompt, targeting specific products (ET/TOI) and output formats (PDF, Word, PPT, Brochure). Includes special frameworks for "ET Prime Sales Training" and "Telesales Data Analysis."

**6.2. Core Functionality:**
- User selects: Product, intended Deck Format.
- User provides context via one of three methods:
    1.  Selecting existing items from the Knowledge Base.
    2.  Directly uploading files (PDF, DOCX, TXT, etc.).
    3.  Writing a direct textual prompt describing the desired training material.
- The system compiles the `knowledgeBaseItems` (metadata and text content for selected/uploaded items/prompt) and a `sourceDescriptionForAi` (e.g., "context from selected KB items").
- This is passed to a Genkit AI flow.
- The AI (Gemini model) generates a structured output including a `deckTitle` and an array of `sections`, where each section has a `title`, `content`, and optional `notes`.
- Special pre-defined frameworks are triggered if the inputs clearly indicate "ET Prime – Sales Training Deck" or "Telesales Data Analysis Framework."

**6.3. "Training Logic" / Replication Guide for Luvable:**

*   **Input Requirements for Luvable:**
    *   `product`: "ET" or "TOI".
    *   `deckFormatHint`: "PDF", "Word Doc", "PPT", "Brochure".
    *   `knowledgeBaseItems`: An array of objects, where each object represents a piece of context (a KB item, an uploaded file, or a user prompt). Each object should contain:
        *   `name`: Name/title of the item.
        *   `textContent` (optional): Full text if it's a text entry or small text file.
        *   `isTextEntry` (boolean): True if it's a direct text prompt/KB text entry.
        *   `fileType` (optional): MIME type if it's a file.
    *   `generateFromAllKb` (boolean): If true, indicates the `knowledgeBaseItems` (if populated) represent the entire relevant KB for the product, or if empty, the AI should use general knowledge.
    *   `sourceDescriptionForAi`: A string describing the source of the context (e.g., "selected KB items: intro.docx, features.txt").

*   **Knowledge Base Dependency:**
    *   The quality of generated material directly depends on the richness of the `knowledgeBaseItems` provided.
    *   For "ET Prime Sales Training Deck", the KB items should ideally contain specifics about ET Prime features, benefits, and sales points.
    *   For "Telesales Data Analysis Framework", KB items might include descriptions of typical data reports (MIS, CDR) or analysis techniques.

*   **AI Prompt Structure & Key Instructions (Simplified):**
    *   **Role:** "You are a presentation and documentation specialist trained to create professional training material..."
    *   **Task:** "Generate content for a training material (deck or brochure). Create a 'deckTitle' and structure content into 'sections' (title, content, notes)."
    *   **Contextual Inputs:** `product`, `deckFormatHint`, `sourceDescriptionForAi`, and the array of `knowledgeBaseItems` (iterated and presented in the prompt).
    *   **Special Frameworks (Conditional Logic in Prompt):**
        *   "If 'product' is 'ET' AND 'Source of Information Context' or item names/content CLEARLY indicate 'ET Prime – Sales Training Deck', then you MUST structure your output using the [ET Prime Sales Training Deck Framework provided in prompt]..."
        *   "If Special Case 1 does NOT apply, AND context CLEARLY indicates 'Telesales Data Analysis Framework', then you MUST structure output using the [Telesales Data Analysis Framework provided in prompt]..."
        *   The prompt contains the fixed structure (section titles, boilerplate content) for these special cases, instructing the AI to flesh them out using the provided `Contextual Information`.
    *   **General Case:** "Synthesize the provided 'Contextual Information'... into a relevant and well-structured training material."
    *   **Content Style Guidance:** The prompt instructs the AI to adapt content style based on `deckFormatHint` (e.g., narrative for PDF/Brochure, bullet points for PPT/Word Doc, visual suggestions for Brochure).
    *   **Output Schema Requirement:** Adherence to `GenerateTrainingDeckOutputSchema` (see `src/ai/flows/training-deck-generator.ts`).

*   **Output Expectation (from AI):** A JSON object matching `GenerateTrainingDeckOutputSchema`.

*   **Key Considerations for Replication in Luvable:**
    *   Luvable's AI needs to handle conditional logic within its prompting system to trigger the special frameworks.
    *   It must be able to synthesize information from multiple `knowledgeBaseItems` into a cohesive output.
    *   The ability to adapt content style based on the `deckFormatHint` is important.

---

## Module 7: AI Data Analyst

**7.1. Overview:**
Simulates an expert data analyst. It takes user descriptions of their data files (Excel, CSV, etc.), their likely structure, and analytical goals, then generates a comprehensive report. It *simulates* data cleaning and interpretation based on the user's text, and can use small text samples (CSV/TXT) for direct observations. It does *not* directly process the internal content of large binary files.

**7.2. Core Functionality:**
- User "uploads" files (provides names and types as context).
- User writes a detailed `userAnalysisPrompt` describing:
    - The files and their content/structure (e.g., "Monthly MIS in Excel with sheets for Oct-May containing columns: Agent Name, Calls Made, Revenue...").
    - Specific file mappings (e.g., "My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'").
    - Decoding rules for coded fields (e.g., "NR = Not Reachable").
    - Specific analytical goals for *this run*.
    - Known data messiness.
- Optionally, a small text sample from the first CSV/TXT file can be provided.
- This input is passed to a Genkit AI flow.
- The AI (Gemini model) acts *as if* it has cleaned, processed, and analyzed the data based *solely* on the user's descriptions and the sample.
- It outputs a structured report including: report title, executive summary, key metrics, detailed analysis (simulated data reconstruction, smart table recognition, time-series trends, comparative performance, use-case insights), chart/table suggestions, recommendations, and direct insights from any text sample.

**7.3. "Training Logic" / Replication Guide for Luvable:**

*   **Input Requirements for Luvable:**
    *   `fileDetails`: An array of objects, each with `fileName` and `fileType`.
    *   `userAnalysisPrompt`: A very detailed (min 50, max 10000 chars) text string as described above. This is the *primary input*.
    *   `sampledFileContent` (optional): A string containing a small sample of a CSV/TXT file.

*   **Knowledge Base Dependency:** None. Relies entirely on the user's prompt and the AI's general analytical capabilities.

*   **AI Prompt Structure & Key Instructions (Simplified):**
    *   **Role:** "You are an advanced Excel analyst AI, specializing in telesales and subscription operations... your job is to intelligently clean, reformat, and analyze business data (as described by the user) for actionable insights."
    *   **Primary Data Source:** "CRITICAL: User's Detailed Data Description & Analysis Prompt: This is your PRIMARY and ESSENTIAL source of information..."
    *   **Simulated Analytical Process (AI is told to *act as if* it performs these):**
        1.  **Data Reconstruction (Simulated Cleanup):** "Based on the user's description of their data... explain briefly in `dataReconstructionAndNormalizationSummary` how you would hypothetically... correct these issues."
        2.  **Table Normalization (Simulated):** "Describe... how you would reconstruct each described sheet... into clean... tables."
        3.  **Smart Table Recognition:** "Explain how you are inferring the purpose of different data tables/sheets described by the user..."
        4.  **KPI Calculation (Based on User's Description):** "From the *assumed* clean tables... calculate or explain how you would calculate key KPIs..." (Prompt includes example KPI definitions).
        5.  **Insight Generation:** "Populate `detailedAnalysis` sections... with insights derived from your simulated analysis..."
    *   **Output Structure Requirement:** Strict adherence to `DataAnalysisReportSchema` (see `src/ai/flows/data-analyzer.ts`), including specific sub-sections for detailed analysis.
    *   **Disclaimer Mandate:** "CRITICALLY IMPORTANT - Always include the standard disclaimer: 'This AI-generated analysis is based on the user's description... AI has NOT directly processed... binary files... User is responsible for verifying...'"
    *   **Handling Insufficient Prompt:** "If the user's prompt is insufficient... state that clearly... Do NOT ask follow-up questions. Generate the best possible report..."

*   **Output Expectation (from AI):** A JSON object matching `DataAnalysisReportSchema`.

*   **Key Considerations for Replication in Luvable:**
    *   Luvable's AI must be capable of complex reasoning and instruction following based on textual descriptions.
    *   It needs to generate highly structured JSON output.
    *   The ability to "simulate" a process and report on that simulation is key.
    *   The prompt is very long and detailed; Luvable must support large prompt inputs.
    *   The AI *must* understand it's not seeing real files (for Excel, PDF etc.) but descriptions of them.

---

## Module 8: Dashboards

**8.1. Overview:**
AI_TeleSuite includes several dashboards to view historical activity and outputs from various modules:
-   **Activity Dashboard:** Logs all user interactions with AI modules (module used, product, agent, timestamp, summary of details).
-   **Transcription Dashboard:** History of transcribed audio files (file name, accuracy, timestamp, preview, link to full transcript).
-   **Call Scoring Dashboard:** History of scored calls (file name, agent, product, overall score, category, timestamp, link to full report).
-   **Training Material Dashboard:** History of generated training materials (title, product, format, context source, timestamp, link to view/download).
-   **Data Analysis Dashboard:** History of generated data analysis reports (report title, user prompt summary, file context count, timestamp, link to full report).

**8.2. Core Functionality:**
-   **Activity Logging:** The `useActivityLogger` hook captures activities from each module. It stores:
    -   `id`, `timestamp`, `module` (e.g., "Pitch Generator"), `product` (if applicable), `agentName` (from user profile).
    -   `details`: A flexible field that can store a string summary or a JSON object containing input parameters and/or the AI's output for that specific activity.
-   These logs are stored in browser localStorage (up to `MAX_ACTIVITIES_TO_STORE` entries).
-   Each dashboard page filters these logs based on the relevant `module` and structures the `details` for display in a table.
-   Dialogs are used to show full details (e.g., complete pitch, full scoring report, full transcript) for selected historical items.
-   Export functionality (CSV, PDF, Text for Word) is provided for dashboard table data.

**8.3. "Training Logic" / Replication Guide for Luvable:**

*   **Dashboards are data presentation layers, not AI generation features.** Their "training" involves understanding the data structure they expect and how this data is logged by other modules.
*   **Data Logging for Luvable:**
    *   A centralized logging mechanism is needed in Luvable. When any AI feature (Pitch Gen, Scoring, etc.) completes an operation, it should log an activity record.
    *   This record should minimally include: `activity_id`, `timestamp`, `module_name`, `user_id/agent_id`, `product_context` (if any), and a `details_payload` (JSON or structured text).
    *   The `details_payload` is crucial. It should contain:
        *   Key input parameters used for the AI call.
        *   The full AI-generated output (or a reference/ID to retrieve it).
        *   Any errors that occurred.
    *   This data should be stored in a persistent database in Luvable.
*   **Dashboard Design in Luvable:**
    *   Each dashboard in Luvable would query this central activity log database, filtering by `module_name`.
    *   The tables would display summary information extracted from the `details_payload`.
    *   "View Details" functionality would retrieve and render the full `details_payload` (e.g., display the full pitch script, render the call scoring card).
*   **Key Considerations for Replication in Luvable:**
    *   Consistent and structured logging from all AI features is paramount.
    *   A robust database schema for storing activity logs.
    *   Efficient querying and presentation mechanisms for the dashboards.
    *   The `details` payload for each module in AI_TeleSuite (`src/types/index.ts` and individual activity logging calls in page components) provide a good reference for what data to store for each activity type. For example:
        *   Pitch Generator logs `pitchOutput` and key `inputData`.
        *   Call Scoring logs `scoreOutput`, `fileName`, `agentNameFromForm`.
        *   Transcription logs `transcriptionOutput`, `fileName`.
        *   Training Material Creator logs `materialOutput` and `inputData`.
        *   Data Analysis logs `analysisOutput` and `inputData`.

---

This detailed breakdown should provide a solid foundation for understanding how AI_TeleSuite's features operate and how their core AI interactions and data dependencies might be replicated or adapted for the "Luvable" platform. The key is always high-quality input data (especially the Knowledge Base) and clear, specific instructions for the AI.
