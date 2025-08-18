
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, generating the AI's TEXT response.
 * Speech synthesis is handled by the client.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  ConversationTurn,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { z } from 'zod';

const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPromptOption2',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: z.object({
      productDisplayName: z.string(),
      customerCohort: z.string(),
      conversationHistory: z.string().describe("A JSON string of the conversation history so far, with each turn labeled 'AI:' or 'User:'. The user has just spoken."),
      fullPitch: z.string().describe("A JSON string of the full generated pitch (for reference)."),
      lastUserResponse: z.string(),
      knowledgeBaseContext: z.string(),
    }) },
    output: { schema: z.object({
      nextResponse: z.string().min(1).describe("The AI agent's next full response to the user. This must be a conversational, detailed, and helpful response. If answering a question, provide a thorough answer. If handling an objection, provide a complete rebuttal. If continuing the pitch, explain the next benefit conversationally."),
      action: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "CLOSING_STATEMENT"]).describe("The category of action the AI is taking."),
      isFinalPitchStep: z.boolean().optional().describe("Set to true if this is the final closing statement of the pitch, just before the call would naturally end."),
    }), format: "json" },
    prompt: `You are a smart, empathetic, and persuasive AI sales expert for {{{productDisplayName}}}. Your goal is to have a natural, helpful, and effective sales conversation.

**Context for this Turn:**
- **Product:** {{{productDisplayName}}}
- **Guiding Pitch Structure:** You have a pre-generated pitch. Use its key points as a guide, but do not recite it verbatim. Adapt it.
  \`\`\`
  {{{fullPitch}}}
  \`\`\`
- **Knowledge Base:** This is your primary source of truth for facts.
  \`\`\`
  {{{knowledgeBaseContext}}}
  \`\`\`
- **Conversation History (User just spoke):**
  {{{conversationHistory}}}

**Your Task:**
Analyze the **Last User Response ("{{{lastUserResponse}}}")** and decide the best next step. Generate a conversational nextResponse.

**Decision Framework:**

1.  **If user asks a question** (e.g., "What are the benefits?"):
    *   **Action:** \`ANSWER_QUESTION\`
    *   **nextResponse:** Provide a comprehensive answer using the **Knowledge Base**.
        *   *Good Example:* "That's a great question. The main benefit our subscribers talk about is the ad-free experience, which really lets you focus on the insights."
        *   *Bad Example:* "The benefits are an ad-free experience and newsletters."

2.  **If user gives a positive or neutral signal** (e.g., "okay", "tell me more"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **nextResponse:** Look at the \`fullPitch\` and history to find the next key point. Create a natural, conversational bridge to it.
        *   *Good GREETING:
You are a top-tier AI coding agent. Your task is to build a complete, production-ready web application from scratch based on the detailed technical specifications below. The application is an "AI_TeleSuite" designed to empower telesales and support teams. Adhere strictly to the versions, libraries, folder structures, and logic flows described.

---

### **Version: v1.0 - Stable Transcription & Scoring**

This document describes the v1.0 state of the application, where the **Audio Transcription** and **AI Call Scoring** features are considered stable. The logic and prompts detailed herein for these features should be considered the baseline for future development.

---

### **1. Core Technology Stack**

*   **Framework:** Next.js (v15.x or latest stable) using the App Router.
*   **Language:** TypeScript.
*   **UI Library:** React (v18.x) with ShadCN UI components. All components (`Accordion`, `Button`, `Card`, `Dialog`, `Input`, `Select`, `Table`, etc.) are pre-built and available under `@/components/ui`.
*   **Styling:** Tailwind CSS. The specific theme and colors are defined in a `globals.css` file.
*   **AI Backend & Orchestration:** Genkit (v1.x) using `@genkit-ai/googleai`. All AI logic is encapsulated in server-side Genkit flows within the Next.js application.
*   **AI Models:** Google's Gemini models, specifically `gemini-2.0-flash` for most tasks and `gemini-1.5-flash-latest` for more complex reasoning or larger context windows.
*   **Client-Side State Management:** Primarily React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). Custom hooks are used for managing `localStorage`.
*   **Text-to-Speech (TTS):** A self-hosted TTS engine (like OpenTTS/Coqui TTS) is expected to be running at `http://localhost:5500/api/tts`. The application will make `POST` requests to this endpoint for voice generation.

---

### **2. Core Project Files & Configuration**

*   **`package.json`**:
    ```json
    {
      "name": "ai-telesuite-replication",
      "version": "0.1.0",
      "private": true,
      "scripts": {
        "dev": "next dev -p 9003",
        "build": "next build",
        "start": "next start",
        "lint": "next lint",
        "typecheck": "tsc --noEmit"
      },
      "dependencies": {
        "@google-cloud/text-to-speech": "^5.3.0",
        "@hookform/resolvers": "^4.1.3",
        "@radix-ui/react-accordion": "^1.2.3",
        "@radix-ui/react-alert-dialog": "^1.1.6",
        "@radix-ui/react-avatar": "^1.1.3",
        "@radix-ui/react-checkbox": "^1.1.4",
        "@radix-ui/react-dialog": "^1.1.6",
        "@radix-ui/react-dropdown-menu": "^2.1.6",
        "@radix-ui/react-label": "^2.1.2",
        "@radix-ui/react-menubar": "^1.1.6",
        "@radix-ui/react-popover": "^1.1.6",
        "@radix-ui/react-progress": "^1.1.2",
        "@radix-ui/react-radio-group": "^1.2.3",
        "@radix-ui/react-scroll-area": "^1.2.3",
        "@radix-ui/react-select": "^2.1.6",
        "@radix-ui/react-separator": "^1.1.2",
        "@radix-ui/react-slider": "^1.2.3",
        "@radix-ui/react-slot": "^1.1.2",
        "@radix-ui/react-switch": "^1.1.3",
        "@radix-ui/react-tabs": "^1.1.3",
        "@radix-ui/react-toast": "^1.2.6",
        "@radix-ui/react-tooltip": "^1.1.8",
        "@tanstack-query-firebase/react": "^1.0.5",
        "@tanstack/react-query": "^5.66.0",
        "class-variance-authority": "^0.7.1",
        "clsx": "^2.1.1",
        "date-fns": "^3.6.0",
        "dotenv": "^16.5.0",
        "firebase": "^11.7.3",
        "geist": "^1.3.0",
        "html2canvas": "^1.4.1",
        "jspdf": "^2.5.1",
        "jspdf-autotable": "^3.8.0",
        "jszip": "^3.10.1",
        "lucide-react": "^0.475.0",
        "next": "15.2.3",
        "patch-package": "^8.0.0",
        "react": "^18.3.1",
        "react-day-picker": "^8.10.1",
        "react-dom": "^18.3.1",
        "react-hook-form": "^7.54.2",
        "recharts": "^2.15.1",
        "tailwind-merge": "^3.0.1",
        "tailwindcss-animate": "^1.0.7",
        "xlsx": "^0.18.5",
        "zod": "^3.24.2",
        "genkit": "^1.0.0",
        "@genkit-ai/googleai": "^1.0.0",
        "@genkit-ai/next": "^1.0.0",
        "genkit-cli": "^1.0.0",
        "wav": "^1.0.2"
      },
      "devDependencies": {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        "postcss": "^8",
        "tailwindcss": "^3.4.1",
        "typescript": "^5"
      }
    }
    ```

*   **`tailwind.config.ts`**: Standard configuration for a ShadCN UI project. The key part is the theme colors defined in `globals.css`.

*   **`src/app/globals.css`**: This file sets up the application's color scheme using CSS variables.
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    body {
      font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
    }

    @layer base {
      :root {
        --background: 192 67% 94%; /* Light Blue (#E5F5F9) */
        --foreground: 200 10% 25%;
        --card: 0 0% 100%;
        --card-foreground: 200 10% 25%;
        --popover: 0 0% 100%;
        --popover-foreground: 200 10% 25%;
        --primary: 197 74% 52%; /* Vibrant Blue (#29ABE2) */
        --primary-foreground: 0 0% 100%;
        --secondary: 192 50% 88%;
        --secondary-foreground: 200 10% 20%;
        --muted: 192 40% 80%;
        --muted-foreground: 200 10% 40%;
        --accent: 36 100% 63%; /* Warm Orange (#FFB347) */
        --accent-foreground: 24 95% 15%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 0 0% 98%;
        --border: 192 30% 75%;
        --input: 0 0% 100%;
        --input-border: 192 30% 70%;
        --ring: 197 74% 52%;
        --radius: 0.5rem;
        --sidebar-background: 200 20% 96%;
        --sidebar-foreground: 200 10% 25%;
        --sidebar-primary: 197 74% 52%;
        --sidebar-primary-foreground: 0 0% 100%;
        --sidebar-accent: 36 100% 63%;
        --sidebar-accent-foreground: 24 95% 15%;
        --sidebar-border: 200 15% 88%;
        --sidebar-ring: 197 74% 52%;
      }
    }
    ```

*   **Environment Variables (`.env`)**: The application requires a Google API key for its Genkit flows.
    ```
    GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_enabled
    ```

---

### **3. Folder & File Structure**

Create the following directory structure and files:

```
/
├── public/
├── src/
│   ├── ai/
│   │   ├── flows/
│   │   │   ├── call-scoring.ts
│   │   │   ├── combined-call-scoring-analysis.ts
│   │   │   ├── data-analyzer.ts
│   │   │   ├── pitch-generator.ts
│   │   │   ├── product-description-generator.ts
│   │   │   ├── rebuttal-generator.ts
│   │   │   ├── speech-synthesis-flow.ts
│   │   │   ├── training-deck-generator.ts
│   │   │   ├── transcription-flow.ts
│   │   │   ├── voice-sales-agent-flow.ts
│   │   │   └── voice-support-agent-flow.ts
│   │   ├── dev.ts
│   │   └── genkit.ts
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── activity-dashboard/page.tsx
│   │   │   ├── batch-audio-downloader/page.tsx
│   │   │   ├── call-scoring/page.tsx
│   │   │   ├── call-scoring-dashboard/page.tsx
│   │   │   ├── combined-call-analysis/page.tsx
│   │   │   ├── create-training-deck/page.tsx
│   │   │   ├── data-analysis/page.tsx
│   │   │   ├── data-analysis-dashboard/page.tsx
│   │   │   ├── home/page.tsx
│   │   │   ├── knowledge-base/page.tsx
│   │   │   ├── pitch-generator/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── rebuttal-generator/page.tsx
│   │   │   ├── training-material-dashboard/page.tsx
│   │   │   ├── transcription/page.tsx
│   │   │   ├── transcription-dashboard/page.tsx
│   │   │   ├── voice-sales-agent/page.tsx
│   │   │   ├── voice-sales-dashboard/page.tsx
│   │   │   ├── voice-support-agent/page.tsx
│   │   │   └── voice-support-dashboard/page.tsx
│   │   │   └── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── features/
│   │   │   ├── activity-dashboard/
│   │   │   ├── call-scoring/
│   │   │   ├── call-scoring-dashboard/
│   │   │   ├── combined-call-analysis/
│   │   │   ├── data-analysis/
│   │   │   ├── data-analysis-dashboard/
│   │   │   ├── knowledge-base/
│   │   │   ├── pitch-generator/
│   │   │   ├── rebuttal-generator/
│   │   │   ├── training-material-dashboard/
│   │   │   ├── transcription/
│   │   │   └── voice-agents/
│   │   ├── icons/logo.tsx
│   │   └── layout/
│   │   └── ui/ (Standard ShadCN components)
│   ├── hooks/
│   │   ├── use-activity-logger.ts
│   │   ├── use-knowledge-base.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-mobile.ts
│   │   ├── use-product-context.tsx
│   │   ├── use-toast.ts
│   │   ├── use-user-profile.ts
│   │   └── use-whisper.ts
│   ├── lib/
│   │   ├── export.ts
│   │   ├── file-utils.ts
│   │   ├── pdf-utils.ts
│   │   └── utils.ts
│   └── types/index.ts
├── .env
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

### **4. UI Design & Layout Structure**

*   **Main Layout (`src/app/(main)/layout.tsx`)**: This is the core layout for the authenticated part of the app. It uses a custom `<AppSidebar>` component on the left and renders the page content within a `<SidebarInset>` component. It also includes a page loading overlay that activates during navigation.
*   **Sidebar (`src/components/layout/app-sidebar.tsx`)**: A collapsible sidebar with accordion-style navigation groups. It displays the current user profile. The navigation structure is defined within this file.
*   **Page Header (`src/components/layout/page-header.tsx`)**: A sticky header at the top of each page that displays the page title and a hamburger menu trigger on mobile.
*   **Component-Based Design**: Each primary feature (e.g., Pitch Generator, Call Scoring) has its own folder within `src/components/features/`. These folders contain the main form, results display components (like `PitchCard`, `CallScoringResultsCard`), and any dashboard-specific tables. This promotes modularity.
*   **Styling**: Use Tailwind CSS utility classes extensively. All colors are derived from the CSS variables defined in `globals.css` (e.g., `bg-primary`, `text-accent`). Components should have rounded corners (`rounded-md`), shadows (`shadow-lg`), and a professional feel.

---

### **5. Feature Implementation & Backend Logic**

The application has no traditional REST API. Instead, frontend client components (pages) use server actions to call Genkit flows located in `src/ai/flows/`. These flows contain all backend and AI logic.

**5.1. Core Hooks (State Management)**

*   **`useLocalStorage`**: A generic hook to persist any state to the browser's `localStorage`.
*   **`useUserProfile`**: Manages the current user's profile name. In this implementation, it's hardcoded to always return `"Anchit"`.
*   **`useProductContext`**: Manages the list of available products (`ET`, `TOI`, `General`, plus user-added ones), persisting them in `localStorage`.
*   **`useKnowledgeBase`**: Manages a `localStorage`-based knowledge base of files and text entries. It includes logic to add, delete, and retrieve entries.
*   **`useActivityLogger`**: A crucial hook that logs every significant user action (generating a pitch, scoring a call, etc.) to `localStorage`. It maintains a list of the last 50 activities.

**5.2. AI Flows (`src/ai/flows/*.ts`)**

*   **`genkit.ts`**: Initializes the global `ai` instance with the `googleAI()` plugin. It includes critical logging to verify that the `GOOGLE_API_KEY` is present.
*   **`transcription-flow.ts`**:
    *   **Function**: `transcribeAudio`
    *   **Input**: `audioDataUri`
    *   **Logic**: Uses `gemini-2.0-flash` to transcribe audio. The prompt contains strict instructions for speaker diarization (`AGENT:`, `USER:`, `RINGING:`), time allotments (`[0 seconds - 15 seconds]`), and transliterating Hinglish to Roman script.
    *   **Output**: A JSON object with `diarizedTranscript` and an AI-assessed `accuracyAssessment`.
*   **`call-scoring.ts`**:
    *   **Function**: `scoreCall`
    *   **Input**: `audioDataUri`, `product`, `agentName?`
    *   **Logic**: First, it internally calls `transcribeAudio`. If successful, it sends the transcript to `gemini-2.0-flash` with a second prompt instructing it to act as a quality analyst. The AI scores the call against predefined metrics (Rapport, Discovery, etc.) based on the transcript and product context.
    *   **Output**: A comprehensive `ScoreCallOutput` JSON object with the transcript, scores, summary, strengths, and areas for improvement.
*   **`combined-call-scoring-analysis.ts`**:
    *   **Function**: `analyzeCallBatch`
    *   **Input**: An array of previously generated `ScoreCallOutput` objects, the product focus, and an optional analysis goal.
    *   **Logic**: Synthesizes information from all individual reports into a single, aggregated analysis. It uses `gemini-1.5-flash-latest` for its larger context window. The prompt instructs the AI to calculate average scores, identify common themes, strengths, and weaknesses across the entire batch.
    *   **Output**: A `CombinedCallAnalysisReportOutput` JSON object containing the full aggregated report.
*   **`pitch-generator.ts`**:
    *   **Function**: `generatePitch`
    *   **Input**: `product`, `customerCohort`, optional plan details, and a `knowledgeBaseContext` string.
    *   **Logic**: Uses `gemini-1.5-flash-latest`. The prompt instructs the AI to act as a telesales assistant and generate a structured pitch. It is strictly instructed to use the `knowledgeBaseContext` as its primary source of truth, especially prioritizing any context from a directly uploaded file.
    *   **Output**: A structured `GeneratePitchOutput` object with distinct fields for each part of the pitch (intro, hook, benefits, full script, etc.).
*   **`rebuttal-generator.ts`**:
    *   **Function**: `generateRebuttal`
    *   **Input**: `objection`, `product`, `knowledgeBaseContext`.
    *   **Logic**: Uses `gemini-2.0-flash`. The prompt instructs the AI to follow an "Acknowledge, Bridge, Benefit, Clarify/Question" structure, synthesizing a response from the provided KB content.
    *   **Output**: A `GenerateRebuttalOutput` object containing the `rebuttal` string.
*   **`training-deck-generator.ts`**:
    *   **Function**: `generateTrainingDeck`
    *   **Input**: `product`, format hint, and context from a direct prompt, uploaded files, or selected KB items.
    *   **Logic**: A flexible content generator using `gemini-2.0-flash`. It has two special-case frameworks (for an "ET Prime Sales Deck" and a "Telesales Data Analysis Framework") that it uses if the user's request matches. Otherwise, it performs a general synthesis of the provided context.
    *   **Output**: A `GenerateTrainingDeckOutput` object with a title and an array of `sections`, each with a title and content.
*   **`data-analyzer.ts`**:
    *   **Function**: `analyzeData`
    *   **Input**: File metadata (name/type), an optional text sample, and a detailed user prompt describing the data's structure and analysis goals.
    *   **Logic**: This feature **simulates** data analysis. It uses `gemini-2.0-flash` with an extensive prompt instructing the AI to act as an analyst. The AI *simulates* data cleaning and KPI calculation based *only* on the user's text description.
    *   **Output**: A detailed `DataAnalysisReportOutput` JSON object, which crucially includes a `limitationsAndDisclaimer` field stating that the analysis is a simulation.
*   **`voice-sales-agent-flow.ts`**:
    *   **Function**: `runVoiceSalesAgentTurn`
    *   **Logic**: The most complex flow, acting as an orchestrator. It uses an internal "router" prompt (`conversationRouterPrompt`) to analyze user input and decide the next action: continue the pitch, answer a question, or handle an objection. It maintains conversation history and calls other flows internally (`generatePitch`, `generateRebuttal`, `scoreCall`, `synthesizeSpeech`).
    *   **Output**: The current state of the conversation, including the AI's next speech output and the expected next action from the user.
*   **`voice-support-agent-flow.ts`**:
    *   **Function**: `runVoiceSupportAgentQuery`
    *   **Logic**: Uses `gemini-1.5-flash-latest` to answer a user's query based on the provided `knowledgeBaseContext`. The prompt instructs the AI to identify if a query requires live data or is unanswerable from the KB, and to suggest escalation in those cases. It then calls `synthesizeSpeech`.
    *   **Output**: The AI's text response, the synthesized speech object, and whether escalation was suggested.
*   **`speech-synthesis-flow.ts`**:
    *   **Function**: `synthesizeSpeech`
    *   **Input**: `textToSpeak`, `voiceProfileId`.
    *   **Logic**: Makes a `POST` request to a self-hosted TTS engine at `http://localhost:5500/api/tts`. The request body is `{"text": textToSpeak, "voice": voiceToUse, "ssml": false}`. It handles the `.wav` response, encodes it to a Base64 `data:` URI, and includes error handling for when the local server is unreachable.
    *   **Output**: A `SimulatedSpeechOutput` object containing the original text and the playable `audioDataUri`.

**5.3. Frontend Page Logic (`src/app/(main)/**/*.tsx`)**

*   **General Pattern**: Each feature page is a client component (`"use client"`). It contains a form component (e.g., `CallScoringForm`) and a results display component (e.g., `CallScoringResultsCard`). The page component handles the `onSubmit` event from the form, calls the relevant server action (Genkit flow), manages the `isLoading` state, and passes the final results to the display component.
*   **Dashboards**: All dashboard pages are client components that read data from `localStorage` via the `useActivityLogger` hook. They filter this data based on the dashboard's specific module (e.g., `"Call Scoring"`). A consistent "View Details" pattern is used where clicking a button opens a `Dialog` component to show the full details of a logged activity, often reusing the primary feature's results card (e.g., `CallScoringResultsCard` is used in the Call Scoring Dashboard). All dashboards also feature data export functionality (CSV, PDF, DOC).

This detailed prompt should provide any competent AI coding agent with all the necessary information to replicate the AI_TeleSuite application with a high degree of fidelity.
Example:* "Great. Building on that, another thing our subscribers find valuable is the exclusive market reports."
        *   *Bad Example:* "The next benefit is exclusive market reports."

3.  **If user raises an objection** (e.g., "it's too expensive"):
    *   **Action:** \`REBUTTAL\`
    *   **nextResponse:** Formulate an empathetic rebuttal using the **"Acknowledge, Empathize, Reframe, Question"** model. Use the Knowledge Base for counter-points.
        *   *Good Example:* "I understand price is an important consideration. Many subscribers feel the exclusive insights save them from costly mistakes, making the subscription pay for itself. Does that perspective help?"
        *   *Bad Example:* "It is not expensive."

4.  **If user is clearly ending the conversation** (e.g., "okay bye", "not interested, thank you", "I have to go"):
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Respond with a polite, brief closing remark.
        *   *Good Example:* "Alright, I understand. Thank you for your time, have a great day!"
        *   *Bad Example:* "Bye."
        
5.  **If conversation is naturally concluding from the AI's side**:
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Provide a clear final call to action.
        *   *Good Example:* "So, based on what we've discussed, would you like me to help you activate your subscription now?"

Generate your response.`,
});


export const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    const response: VoiceSalesAgentFlowOutput = {
      conversationTurns: Array.isArray(flowInput.conversationHistory) ? [...flowInput.conversationHistory] : [],
      generatedPitch: flowInput.currentPitchState,
      nextExpectedAction: 'USER_RESPONSE',
      errorMessage: undefined,
      currentAiResponseText: undefined,
    };
    
    try {
        let {
            action, product, productDisplayName, brandName, salesPlan, etPlanConfiguration,
            offer, customerCohort, agentName, userName, knowledgeBaseContext,
            currentUserInputText,
        } = flowInput;

        // This flow now only processes user responses. The 'START_CONVERSATION' action is handled client-side.
        if (action === 'PROCESS_USER_RESPONSE') {
            if (!response.generatedPitch) throw new Error("Pitch state is missing, cannot continue conversation.");
            if (!currentUserInputText) throw new Error("User input text not provided for processing.");

            try {
                const { output: routerResult } = await conversationRouterPrompt({
                    productDisplayName: productDisplayName, customerCohort: customerCohort,
                    conversationHistory: JSON.stringify(response.conversationTurns),
                    fullPitch: JSON.stringify(response.generatedPitch), lastUserResponse: currentUserInputText,
                    knowledgeBaseContext: knowledgeBaseContext,
                });

                if (!routerResult || !routerResult.nextResponse) {
                    throw new Error("AI router failed to determine the next response.");
                }
                
                response.currentAiResponseText = routerResult.nextResponse;
                response.nextExpectedAction = routerResult.isFinalPitchStep ? 'INTERACTION_ENDED' : 'USER_RESPONSE';
            } catch (routerError: any) {
                 const errorMessage = `I'm sorry, I had trouble processing that. Could you please rephrase? (Error: ${routerError.message.substring(0, 100)}...)`;
                 response.errorMessage = routerError.message;
                 response.currentAiResponseText = errorMessage;
                 response.nextExpectedAction = 'USER_RESPONSE';
            }

        } else if (action === 'END_CALL') {
            response.currentAiResponseText = `Thank you for your time, ${userName || 'sir/ma\'am'}. Have a great day.`;
            response.nextExpectedAction = 'INTERACTION_ENDED';
        } else {
             throw new Error(`Invalid action received by the flow: ${action}. This flow only handles 'PROCESS_USER_RESPONSE' and 'END_CALL'.`);
        }
        
        // The client will add the AI's response text to the conversation log. We return it here.
        // response.conversationTurns is just passed through from input.

        return response;

    } catch (e: any) {
      console.error("Critical Unhandled Error in runVoiceSalesAgentTurn:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      const errorMessage = `I'm sorry, a critical system error occurred. Details: ${e.message.substring(0, 200)}...`;
      
      response.errorMessage = e.message;
      response.currentAiResponseText = errorMessage;
      response.nextExpectedAction = 'END_CALL_NO_SCORE';
      
      return response;
    }
  }
);

    