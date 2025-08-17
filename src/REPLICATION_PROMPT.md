
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
*   **AI Models:** Google's Gemini models, specifically `gemini-2.0-flash` for most tasks and `gemini-1.5-flash-latest` for more complex reasoning or larger context windows. The TTS API uses Google Cloud Text-to-Speech models.
*   **Client-Side State Management:** Primarily React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). Custom hooks are used for managing `localStorage`.
*   **Text-to-Speech (TTS):** A self-hosted Next.js API route at `/api/tts` which uses the `@google-cloud/text-to-speech` library to generate audio. This requires Google Application Default Credentials to be set up.

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
        "typescript": "^5",
        "raw-loader": "^4.0.2"
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

*   **Environment Variables (`.env`) & Credentials**: 
    - A `.env` file is needed with `GEMINI_API_KEY=your_google_api_key`.
    - A `key.json` file (your Google Cloud Service Account key) must be placed in the project root. This is used by the TTS API route.

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
│   │   │   ├── voice-support-dashboard/page.tsx
│   │   │   ├── clone-app/page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── clone-app/route.ts
│   │   │   └── tts/route.ts
│   │   ├── login/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── features/ (Modular components for each feature page)
│   │   ├── icons/logo.tsx
│   │   └── layout/ (Sidebar, Header)
│   │   └── ui/ (Standard ShadCN components)
│   ├── hooks/
│   │   ├── use-activity-logger.ts
│   │   ├── use-knowledge-base.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-product-context.tsx
│   │   ├── use-toast.ts
│   │   ├── use-user-profile.ts
│   │   └── useWhisper.ts
│   ├── lib/ (Utility functions for export, files, pdfs)
│   └── types/index.ts
├── .env
├── key.json
├── next.config.js
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

The application has no traditional REST API for business logic. Instead, frontend client components (pages) use server actions to call Genkit flows located in `src/ai/flows/`. These flows contain all backend and AI logic.

**5.1. Core Hooks (State Management)**

*   **`useLocalStorage`**: A generic hook to persist any state to the browser's `localStorage`.
*   **`useUserProfile`**: Manages the current user's profile name.
*   **`useProductContext`**: Manages the list of available products, persisting them in `localStorage`.
*   **`useKnowledgeBase`**: Manages a `localStorage`-based knowledge base of files and text entries. Includes default system entries for ET and TOI.
*   **`useActivityLogger`**: A crucial hook that logs every significant user action (generating a pitch, scoring a call, etc.) to `localStorage`. It maintains a list of the last 50 activities.

**5.2. AI Flows (`src/ai/flows/*.ts`)**

*   **`genkit.ts`**: Initializes the global `ai` instance with the `googleAI()` plugin.
*   **`transcription-flow.ts`**: Transcribes audio using `gemini-2.0-flash`, with strict rules for speaker diarization and language.
*   **`call-scoring.ts`**: Scores a call transcript against a detailed rubric using `gemini-1.5-flash-latest`. Includes a fallback to a simpler model for resilience.
*   **`combined-call-scoring-analysis.ts`**: Synthesizes multiple call scoring reports into a single batch analysis using `gemini-1.5-flash-latest`.
*   **`pitch-generator.ts`**: Generates a structured sales pitch using `gemini-1.5-flash-latest`, prioritizing context from uploaded files over the general knowledge base.
*   **`rebuttal-generator.ts`**: Generates a rebuttal for a customer objection using an "Acknowledge, Bridge, Benefit, Clarify/Question" structure.
*   **`training-deck-generator.ts`**: A flexible content generator that uses `gemini-2.0-flash`. Includes special frameworks for specific training deck requests.
*   **`data-analyzer.ts`**: **Simulates** data analysis based on a user's detailed description of their data files. Critically, it includes a disclaimer about this simulation.
*   **`voice-sales-agent-flow.ts`**: Orchestrates a turn-by-turn sales conversation, calling other flows internally.
*   **`voice-support-agent-flow.ts`**: Answers user support queries based on the knowledge base, with the ability to suggest escalation for out-of-scope questions.
*   **`speech-synthesis-flow.ts`**: **Simulated** speech synthesis. The flow calls the `/api/tts` route which uses the Google Cloud TTS API to generate real audio.
*   **`generate-full-call-audio.ts`**: Creates a single, multi-speaker audio file from a conversation history using a TTS model.

**5.3. API Routes (`src/app/api/**/*.ts`)**
*   **/api/tts/route.ts**: An API endpoint that receives text and a voice profile, calls the Google Cloud Text-to-Speech service, and returns a Base64 audio Data URI. This provides the backend for all TTS functionality.
*   **/api/clone-app/route.ts**: A server-side route that reads all relevant project source files, packages them into a ZIP archive, and returns it for download. This is the backend for the "Clone App" feature.

**5.4. Frontend Page Logic (`src/app/(main)/**/*.tsx`)**

*   **General Pattern**: Each feature page is a client component (`"use client"`). It contains a form component (e.g., `CallScoringForm`) and a results display component (e.g., `CallScoringResultsCard`). The page component handles form submission, calls the relevant server action (Genkit flow), manages loading states, and passes results to the display component.
*   **Dashboards**: All dashboard pages are client components that read data from `localStorage` via the `useActivityLogger` hook. They filter this data based on the dashboard's specific module (e.g., `"Call Scoring"`). A consistent "View Details" pattern is used where clicking a button opens a `Dialog` to show the full details of a logged activity, often reusing the primary feature's results card. All dashboards feature data export functionality.
*   **Clone App Page**: A page that provides a button to trigger a download from the `/api/clone-app` route and a text area to copy the full `REPLICATION_PROMPT.md` content.

This detailed prompt should provide any competent AI coding agent with all the necessary information to replicate the AI_TeleSuite application with a high degree of fidelity.
