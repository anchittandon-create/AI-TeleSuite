
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

*   **`package.json`**:
    ```json
    {
      "name": "ai-telesuite-replication",
      "version": "0.1.1",
      "private": true,
      "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "NODE_ENV=production next start -p 9003",
        "lint": "next lint",
        "typecheck": "tsc --noEmit"
      },
      "dependencies": {
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
        "@tanstack/react-query": "^5.66.0",
        "class-variance-authority": "^0.7.1",
        "clsx": "^2.1.1",
        "cmdk": "^1.0.0",
        "date-fns": "^3.6.0",
        "docx-preview": "^0.3.2",
        "geist": "^1.3.0",
        "jspdf": "^2.5.1",
        "jspdf-autotable": "^3.8.0",
        "jszip": "^3.10.1",
        "lucide-react": "^0.475.0",
        "next": "15.2.3",
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
        "raw-loader": "^4.0.2",
        "tailwindcss": "^3.4.1",
        "typescript": "^5"
      }
    }
    ```

*   **`tailwind.config.ts`**: Standard configuration for a ShadCN UI project.

*   **`src/app/globals.css`**: Defines the application's color scheme using CSS variables.
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    body {
      font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
    }

    @layer base {
      :root {
        --background: 192 67% 94%;
        --foreground: 200 10% 25%;
        --card: 0 0% 100%;
        --card-foreground: 200 10% 25%;
        --popover: 0 0% 100%;
        --popover-foreground: 200 10% 25%;
        --primary: 197 74% 52%;
        --primary-foreground: 0 0% 100%;
        --secondary: 192 50% 88%;
        --secondary-foreground: 200 10% 20%;
        --muted: 192 40% 80%;
        --muted-foreground: 200 10% 40%;
        --accent: 36 100% 63%;
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

*   **Credentials & API Keys**:
    *   **`.env` File**: Requires a Google API key with the Gemini and Cloud Text-to-Speech APIs enabled. The key must be duplicated for client-side access.
        ```
        GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_enabled
        NEXT_PUBLIC_GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_enabled
        ```
    *   **`key.json` File**: A service account key is required for Genkit server-side authentication. Place the following content in `key.json` at the project root.
        ```json
        {
          "type": "service_account",
          "project_id": "pitchperfect-ai-s0jx8",
          "private_key_id": "fa4d1e45514c06ec90d65fa9137e08502bd46905",
          "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEVQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCkk/FqsCXTQF54\nzn6UT33EomTcxjLtrxWYh+UmD0omvaJ+rn9zsthhJruBCYtSZDSq52+hHd3sGX3D\n7z80bbQMzWSx2h0vm52bR2ddWRxzV2ETWA1Kv4yC1r5v8x8xPvE4X+DG0ts5NCDw\nivgXK5pKcmGyncFG9EnFqcZewt+004eeeb2qUGbq0xsc2+5gvxHoeK\n8RpzWZmXs2pMg/7PeAvblcCjVAGRBShAw38ydzdVF8X0VL11GBHxepofh2hiFAnu\nHgvlLG5rAgMBAAECggEAAXcdvaTu2Ugn7yxrfRe0F5uYiUysdGhMdIRw0YlSujS2\nzfOLmGPUnBPxPuhr5bkriyB8bIG2SUURpNd9acMJs6dRlHZ8fU\nJSnb9ByUf9iHuWy8xo/a4tb2ZiUVLWp5af7Z0MlizsW4pQPd3u4tDGt0KNS6ecC2\nu0tdr/FT6WxNC79tPgYcSrqvPW0owIlZ4rlBlcwN0elCtNJRz9E\nSz9tVBETG4gcaBqfnGx016sHKuYHlV2I4w4yrss8yXY0zZTrecd0HdJLPbsUk3wf\nqrDgVZbMsxriWGtFLsKFRJjKjwKBgQDJrrdXKM2K7Gm1eYs3ZYCPHxSJICCAg3Wo\nNsvkMlYxVU9y+pLwumGj1i9g8ddK6b590AdrPPLvxQEnVf2Bw03n\nkgxLtWU8ZQKBgH03se0MU4nZfWVBxICrIvMvhTs36rmJ2bwlCT2wJ83N0VtWK74r\nDrZfcc0CZ3D+1Tqec4eZls0epoGN/ObIw/68taSe+JunEgHmuHUJelJYGSJiGBeq0n\nrUPdZHyJqGxEEGgSP7TAoGBAJ7b\njLQNgqELiFQWEY8n1zRkccN018UCRxmxPFNBBFBVDFVXnmoBWRIjkZDpvC/qcJYE\n9Hz/W0d0JbBnOtz3lsL7AKAVxXYi/wr7BMixF4sLvVc109NDLdsb7EGPl1AgLqpj\nGdyNgVwTcyUcR8uzLV005D18pbqfYYTGAAL2NXB1AoGAd3xPPwDK2WgHD7YD5z1M\nt0iIZjtj8tCsGmJu3t0VjshfqIWrAF38iMWTjzZfg6vxkofvHDQNdxn3fCNaKTIw\n70+e0f\ndkAE0dl6B4grj8odxlA+rAs=\n-----END PRIVATE KEY-----\n",
          "client_email": "ai-telesuitefinal@pitchperfect-ai-s0jx8.iam.gserviceaccount.com",
          "client_id": "109156462036092362629",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/ai-telesuitefinal%40pitchperfect-ai-s0jx8.iam.gserviceaccount.com",
          "universe_domain": "googleapis.com"
        }
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
│   │   │   ├── generate-full-call-audio.ts
│   │   │   ├── pitch-generator.ts
│   │   │   ├── product-description-generator.ts
│   │   │   ├── rebuttal-generator.ts
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
│   │   │   ├── clone-app/page.tsx
│   │   │   ├── combined-call-analysis/page.tsx
│   │   │   ├── combined-call-analysis-dashboard/page.tsx
│   │   │   ├── create-training-deck/page.tsx
│   │   │   ├── data-analysis/page.tsx
│   │   │   ├── data-analysis-dashboard/page.tsx
│   │   │   ├── home/page.tsx
│   │   │   ├── knowledge-base/page.tsx
│   │   │   ├── n8n-workflow/page.tsx
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
│   │   ├── api/
│   │   │   ├── clone-app/route.ts
│   │   │   └── n8n-workflow/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── common/loading-spinner.tsx
│   │   ├── features/
│   │   │   ├── activity-dashboard/
│   │   │   ├── call-scoring/
│   │   │   ├── call-scoring-dashboard/
│   │   │   ├── combined-call-analysis/
│   │   │   ├── data-analysis/
│   │   │   ├── data-analysis-dashboard/
│   │   │   ├── knowledge-base/
│   │   │   ├── pitch-generator/
│   │   │   ├── products/
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
│   │   ├── use-voice-samples.ts
│   │   └── use-whisper.ts
│   ├── lib/
│   │   ├── export.ts
│   │   ├── file-utils.ts
│   │   ├── pdf-utils.ts
│   │   ├── tts-client.ts
│   │   └── utils.ts
│   ├── styles/transcript.css
│   └── types/index.ts
├── REPLICATION_PROMPT.md
├── next.config.js
├── package.json
└── tsconfig.json
```

---

### **4. UI Design & Layout Structure**

*   **Main Layout (`src/app/(main)/layout.tsx`)**: The core layout for the authenticated app. It includes the `<AppSidebar>` on the left and renders page content within a `<SidebarInset>` component. A page loading overlay is displayed during navigation.
*   **Sidebar (`src/components/layout/app-sidebar.tsx`)**: A collapsible sidebar with accordion-style navigation groups. It's defined by a static `navStructure` array. It shows the current user profile. The navigation structure MUST place each dashboard link directly *after* its corresponding feature link.
*   **Page Header (`src/components/layout/page-header.tsx`)**: A sticky header displaying the page title and a hamburger menu trigger on mobile.
*   **Component-Based Design**: Each feature has its own folder in `src/components/features/`. These folders contain the main form, results display components (`PitchCard`, `CallScoringResultsCard`), and dashboard-specific tables.

---

### **5. Feature Implementation & Backend Logic**

The application uses server actions to call Genkit flows located in `src/ai/flows/`.

**5.1. Core Hooks (State Management)**

*   **`useLocalStorage`**: Generic hook to persist state to `localStorage`.
*   **`useUserProfile`**: Manages the current user's profile name (hardcoded to "Anchit").
*   **`useProductContext`**: Manages the list of products (`ET`, `TOI`, `General`, plus user-added ones) in `localStorage`.
*   **`useKnowledgeBase`**: Manages a `localStorage`-based knowledge base of files and text entries.
*   **`useActivityLogger`**: Logs every significant user action to `localStorage`.
*   **`useWhisper`**: A hardened hook that manages the `SpeechRecognition` API. It handles start/stop logic and provides callbacks for both interim (`onTranscribe`) and final (`onTranscriptionComplete`) results. It includes robust timers for silence and inactivity detection.

**5.2. AI Flows (`src/ai/flows/*.ts`)**

*   **`genkit.ts`**: Initializes the global `ai` instance with the `googleAI()` plugin.
*   **`transcription-flow.ts`**:
    *   **Function**: `transcribeAudio`
    *   **Logic**: Uses a dual-model, resilient strategy. It first attempts transcription with `gemini-2.0-flash`. If that fails, it retries with the more powerful `gemini-1.5-flash-latest`. The prompt is simplified for reliability and instructs the AI to include time allotments (`[0 seconds - 15 seconds]`).
*   **`call-scoring.ts`**:
    *   **Function**: `scoreCall`
    *   **Input**: `transcriptOverride` (required), `product`, `agentName?`, `audioDataUri` (optional for tonality), `productContext`, `brandUrl`.
    *   **Logic**: This flow now *only* scores a provided transcript. It uses `gemini-1.5-flash-latest` with a detailed, 75-metric rubric. The prompt explicitly expects time allotments in the transcript. If the primary model fails, it falls back to `gemini-2.0-flash` with a simpler rubric to ensure a result is always returned.
*   **`combined-call-scoring-analysis.ts`**:
    *   **Function**: `analyzeCallBatch` - Synthesizes multiple `ScoreCallOutput` objects into a single aggregated report using `gemini-1.5-flash-latest`.
    *   **Function**: `generateOptimizedPitches` - Takes the output of the combined analysis and uses it as `optimizationContext` to call the `generatePitch` flow for multiple cohorts, creating data-driven pitches.
*   **`pitch-generator.ts`**:
    *   **Function**: `generatePitch`
    *   **Logic**: Uses `gemini-1.5-flash-latest`. The prompt is now more resilient: if the `knowledgeBaseContext` is insufficient, it is explicitly authorized to supplement its knowledge by browsing the provided `brandUrl`. It also correctly handles the optional `optimizationContext` to refine the pitch based on past call performance.
*   **`rebuttal-generator.ts`**:
    *   **Function**: `generateRebuttal`
    *   **Logic**: Uses `gemini-1.5-flash-latest` with a prompt instructing it to follow the "Acknowledge, Bridge, Benefit, Clarify/Question" structure. If the KB is insufficient, it can browse the `brandUrl`. It also has a non-AI, rule-based fallback (`generateFallbackRebuttal`) for maximum reliability.
*   **`training-deck-generator.ts`**:
    *   **Function**: `generateTrainingDeck`
    *   **Logic**: A flexible content generator that uses `gemini-2.0-flash`. It has special-case frameworks for "ET Prime Sales Deck" and "Telesales Data Analysis Framework" and a general case for all other requests.
*   **`data-analyzer.ts`**:
    *   **Function**: `analyzeData`
    *   **Logic**: Simulates data analysis using `gemini-2.0-flash`. The AI acts as an analyst, simulating data cleaning and KPI calculation based *only* on the user's detailed text description. The output includes a disclaimer about the simulation.
*   **`voice-sales-agent-flow.ts`**:
    *   **Function**: `runVoiceSalesAgentTurn`
    *   **Logic**: The orchestrator for the voice sales agent.
        1.  On `START_CONVERSATION`, it first calls `generatePitch` to get the full script.
        2.  On `PROCESS_USER_RESPONSE`, it uses a fast "router" prompt (`conversationRouterPrompt`) to decide the next action (continue pitch, answer question, handle objection).
        3.  It then calls specialized, smaller prompts (`salesAnswerGeneratorPrompt`, `supportAnswerGeneratorPrompt`, `objectionHandlerPrompt`) to get a quick, KB-grounded response. This modular approach ensures speed and relevance.
*   **`voice-support-agent-flow.ts`**:
    *   **Function**: `runVoiceSupportAgentQuery`
    *   **Logic**: Uses `gemini-1.5-flash-latest` to answer a user's query based on the `knowledgeBaseContext`. The prompt instructs the AI to identify if a query requires live data or is unanswerable from the KB and to suggest escalation.

**5.3. Frontend Page Logic (`src/app/(main)/**/*.tsx`)**

*   **General Pattern**: Each feature page is a client component (`"use client"`). It handles `onSubmit` events, calls the relevant server action (Genkit flow), manages `isLoading` states, and passes results to display components.
*   **`call-scoring/page.tsx`**: The frontend is now responsible for the two-step process. It first calls `transcribeAudio`. On success, it then calls `scoreCall`, passing the resulting transcript in the `transcriptOverride` field. This ensures resilience.
*   **`voice-sales-agent/page.tsx` & `voice-support-agent/page.tsx`**: These pages are complex state machines.
    *   They use the `useWhisper` hook for ASR, configured for low latency.
    *   **Barge-in:** Is implemented in the `onTranscribe` callback, which immediately stops any ongoing TTS audio playback when user speech is detected.
    *   **Inactivity:** A `setTimeout` is used to detect when the user hasn't spoken after the agent finishes, triggering a reminder turn.
    *   They call the `synthesizeSpeechOnClient` utility for all TTS needs.
    *   On call end, they now correctly `await` the `scoreCall` function before saving the final activity log, ensuring the score is always included. A `<PostCallReview>` component is used to display all final artifacts.
*   **`combined-call-analysis/page.tsx`**: Redesigned for a cleaner UX. It uses a `ReportSelectionTable` component with checkboxes to allow users to easily select which historical reports to include in the analysis.
*   **Dashboards**: All dashboard pages are client components that read data from `localStorage` via the `useActivityLogger` hook and provide filtering and "View Details" functionality in a `Dialog`.

This detailed prompt provides all necessary information for any competent AI coding agent to replicate the AI_TeleSuite application with a high degree of fidelity.
