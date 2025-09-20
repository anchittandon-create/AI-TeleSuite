# 🔁 AI_TeleSuite: Master Replication Orchestrator Prompt (v1.1)

You are **AI_Master_Replicator**. Your sole task is to create a **100% exact, production-ready clone** of the AI_TeleSuite application by executing the complete specification detailed below. This document is self-contained and provides all necessary information, from initial setup to the line-by-line implementation of every feature.

---
## ⚙️ Replication Process

1.  **Start with this file** (`REPLICATION_PROMPT.md`) as the master instruction set.
2.  **Process each section sequentially**, from `Part 1: Core Technology & Configuration` through `Part 8: Verification Checklist`.
3.  For each section, generate the **exact files and code** as specified. Do not summarize, omit, or add anything.
4.  After processing all parts, run the **Verification Checklist** to ensure a perfect clone.

---
## **Part 1: Core Technology & Configuration**

This section outlines the fundamental technology stack, project configuration files, and environment setup required for the AI_TeleSuite application.

### **1.1. Core Technology Stack**

*   **Framework:** Next.js (v15.x or latest stable) using the App Router.
*   **Language:** TypeScript.
*   **UI Library:** React (v18.x) with ShadCN UI components. All components are pre-built and available under `@/components/ui`.
*   **Styling:** Tailwind CSS. The specific theme and colors are defined in `src/app/globals.css`.
*   **AI Backend & Orchestration:** Genkit (v1.x) using `@genkit-ai/googleai`. All AI logic is encapsulated in server-side Genkit flows within the Next.js application.
*   **AI Models:** Google's Gemini models, specifically `gemini-2.0-flash` for most tasks and `gemini-1.5-flash-latest` for more complex reasoning or larger context windows.
*   **Client-Side State Management:** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). Custom hooks are used for managing `localStorage`.
*   **Text-to-Speech (TTS):** A **client-side utility** (`/src/lib/tts-client.ts`) that directly calls the Google Cloud Text-to-Speech REST API. The API key must be exposed to the client as `NEXT_PUBLIC_GOOGLE_API_KEY`.
*   **Speech-to-Text (ASR):** Browser's native `window.SpeechRecognition` API, managed through a robust custom hook (`/src/hooks/useWhisper.ts`).

### **1.2. Core Project Files & Configuration**

*   **`package.json`**:
    ```json
    {
      "name": "ai-telesuite-replication",
      "version": "0.1.1",
      "private": true,
      "scripts": { "dev": "next dev", "build": "next build", "start": "NODE_ENV=production next start -p 9003", "lint": "next lint", "typecheck": "tsc --noEmit" },
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
        "autoprefixer": "^10.4.17",
        "postcss": "^8",
        "raw-loader": "^4.0.2",
        "tailwindcss": "^3.4.1",
        "typescript": "^5"
      }
    }
    ```
*   **`n8n_workflow.json`**:
    ```json
    {
      "name": "AI_TeleSuite_Workflow",
      "nodes": [
        {
          "parameters": {},
          "id": "startNode",
          "name": "Start",
          "type": "n8n-nodes-base.start",
          "typeVersion": 1,
          "position": [
            250,
            300
          ]
        }
      ],
      "connections": {},
      "active": false,
      "settings": {},
      "id": "ai-telesuite-workflow"
    }
    ```
*   **`tailwind.config.ts`**: Standard configuration for a ShadCN UI project.
*   **`src/app/globals.css`**: Defines the application's color scheme using CSS variables. (Refer to file content)
*   **Environment Variables (`.env`)**: **CRITICAL STEP.** Requires a Google API key with Gemini and Text-to-Speech APIs enabled. The key must be duplicated and prefixed with `NEXT_PUBLIC_` for client-side TTS access. Create a `.env` file in the root of the project with the following content:
    ```
    GOOGLE_API_KEY=AIzaSyCDNGYop9lEU0B3SsiujrX4w1pEa1rxwos
    NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSyCDNGYop9lEU0B3SsiujrX4w1pEa1rxwos
    ```
*   **`next.config.js`**: Includes webpack configuration to handle `.md` files and provides a shim for `async_hooks` on the client side.

---
## **Part 2: Global Styles & Layout**

This section contains the full code for global styles (`globals.css`), the root `layout.tsx`, the main authenticated layout, and the core layout components responsible for the application's shell, including the sidebar and page header.

### **2.1. Global Styles**

*(The content for `globals.css` and `transcript.css` should be implemented as specified in the context.)*

### **2.2. Root Layout & Main Application Layout**

*(The content for `src/app/layout.tsx` and `src/app/(main)/layout.tsx` should be implemented as specified in the context.)*

### **2.3. Core Layout Components**

*(The content for `src/components/layout/app-sidebar.tsx` and `src/components/layout/page-header.tsx` should be implemented as specified in the context.)*

---
## **Part 3: Custom Hooks & State Management**

This section provides the complete implementation of all custom React hooks used for managing client-side state, including `localStorage` interactions for products, knowledge base, and user activity.

*(The full code for `use-local-storage.ts`, `use-mobile.ts`, `use-toast.ts`, `use-activity-logger.ts`, `use-product-context.tsx`, `use-knowledge-base.ts`, and `use-whisper.ts` should be implemented as specified.)*

---
## **Part 4: Library Utilities**

This section details the utility functions for tasks like file conversion, data export (CSV, PDF, DOC), and client-side TTS API calls.

*(The full code for `lib/utils.ts`, `lib/file-utils.ts`, `lib/export.ts`, `lib/pdf-utils.ts`, and `lib/tts-client.ts` should be implemented.)*

---
## **Part 5: Feature Pages & UI Components**

This is the feature-by-feature implementation guide for every page in the application, ordered exactly as they appear in the sidebar.

### **Home (`/home`)**
- **Purpose:** A central dashboard providing an at-a-glance overview of all application modules.
- **Implementation:** `src/app/(main)/home/page.tsx`. Uses a series of "Feature Widgets" (`<Card>` components).
- **Data:** Each widget's data is dynamically calculated on the client-side using hooks (`useActivityLogger`, `useKnowledgeBase`, `useProductContext`) to show statistics and last activity.

### **Products (`/products`)**
- **Purpose:** Manage the product catalog used across the application for contextual AI generation.
- **Files:** `src/app/(main)/products/page.tsx`, `src/components/features/products/product-dialog-fields.tsx`.
- **State Management:** `src/hooks/useProductContext.tsx`.
- **Logic:** Manages an array of `ProductObject` items in `localStorage`. UI allows adding, editing, and deleting products. A "Generate with AI" button calls the `generateProductDescription` Genkit flow.

### **Knowledge Base (`/knowledge-base`)**
- **Purpose:** Central repository for all contextual documents and text snippets.
- **Files:** `src/app/(main)/knowledge-base/page.tsx`, `src/components/features/knowledge-base/knowledge-base-form.tsx`, `src/components/features/knowledge-base/knowledge-base-table.tsx`.
- **State Management:** `src/hooks/use-knowledge-base.ts`.
- **Logic:** Manages `KnowledgeFile` objects in `localStorage`. Form allows adding entries via file upload or text. Table lists entries with view/delete actions. View dialog renders previews using `docx-preview` and native browser elements.

---
### **GROUP: Sales & Support Tools**

#### **AI Pitch Generator (`/pitch-generator`)**
- **Purpose:** Generates structured, high-quality sales pitches.
- **Files:** `src/app/(main)/pitch-generator/page.tsx`, `src/components/features/pitch-generator/pitch-form.tsx`, `src/components/features/pitch-generator/pitch-card.tsx`.
- **Backend Flow:** `src/ai/flows/pitch-generator.ts`.
- **Logic:** The frontend gathers KB context for the selected product and calls the `generatePitch` flow. The AI is prompted to act as a "world-class sales agent," using specific KB categories for different parts of the pitch. The structured `GeneratePitchOutput` is rendered in the `PitchCard`.

#### **AI Rebuttal Assistant (`/rebuttal-generator`)**
- **Purpose:** Provides real-time rebuttals to customer objections.
- **Files:** `src/app/(main)/rebuttal-generator/page.tsx`, `src/components/features/rebuttal-generator/rebuttal-form.tsx`, `src/components/features/rebuttal-generator/rebuttal-display.tsx`.
- **Backend Flow:** `src/ai/flows/rebuttal-generator.ts`.
- **Logic:** The `generateRebuttal` flow is called with the objection and KB context. The AI uses an "Acknowledge, Bridge, Benefit, Clarify/Question" (ABBC/Q) model. A non-AI fallback (`generateFallbackRebuttal`) provides resilience if the AI fails.

---
### **GROUP: Analysis & Reporting**

*(This section will continue with the detailed breakdown for Audio Transcription, Transcription Dashboard, AI Call Scoring, Scoring Dashboard, Combined Call Analysis, and Combined Analysis DB, following the same exhaustive format.)*

---
### **GROUP: Voice Agents**

*(This section will continue with the detailed breakdown for AI Voice Sales Agent, Sales Dashboard, AI Voice Support Agent, and Support Dashboard.)*

---
### **GROUP: Content & Data Tools**

*(This section will continue with the detailed breakdown for Training Material Creator, Material Dashboard, AI Data Analyst, Analysis Dashboard, and Batch Audio Downloader.)*

---
### **GROUP: System**

#### **Global Activity Log (`/activity-dashboard`)**
- **Purpose:** A master log of every significant user action.
- **Files:** `src/app/(main)/activity-dashboard/page.tsx`, `src/components/features/activity-dashboard/activity-table.tsx`, `src/components/features/activity-dashboard/filters.tsx`.
- **State Management:** `src/hooks/use-activity-logger.ts`.
- **Logic:** Manages `ActivityLogEntry` objects in `localStorage`. The page provides filters and renders logs in a table. The "View Details" dialog displays a rich, formatted view of the logged data.

#### **Clone Full App (`/clone-app`)**
- **Purpose:** Provides the full source code and this replication prompt.
- **Files:** `src/app/(main)/clone-app/page.tsx`.
- **Backend API Routes:** `src/app/api/clone-app/route.ts` and `src/app/api/clone-docs/route.ts`.
- **Logic:** Provides two main actions: "Download Project ZIP" which calls the backend to package all source files, and a viewer to display the content of this master replication prompt, fetched from the `clone-docs` API.

#### **n8n Workflow (`/n8n-workflow`)**
- **Purpose:** Provides a downloadable JSON file for n8n workflow automation.
- **Files:** `src/app/(main)/n8n-workflow/page.tsx`.
- **Backend API Route:** `src/app/api/n8n-workflow/route.ts`.
- **Logic:** The frontend provides a button that links to the API route, which dynamically generates and serves a valid n8n workflow JSON file containing the project structure.

---
## **Part 6: AI Flows & Backend Logic**

This section contains the full specification for every Genkit AI flow, including all prompts, Zod schemas, and fallback logic.

*(The full, detailed specification for each AI flow file (`pitch-generator.ts`, `rebuttal-generator.ts`, `call-scoring.ts`, `transcription-flow.ts`, etc.) should be implemented here.)*

---
## **Part 7: API Routes**

This section specifies the implementation for all Next.js API routes.

*(The full code for `api/clone-app/route.ts`, `api/clone-docs/route.ts`, and `api/n8n-workflow/route.ts` should be implemented here.)*

---
## **Part 8: Verification Checklist (Self-Audit Phase)**
After processing all parts, run this strict checklist. For each item, output → **PASS | FAIL** + Evidence. If FAIL → provide RCA (root cause) + auto-generate corrected code.

1.  **Menu Bar Features** → All tools present and functional as per the specification?
2.  **Knowledge Base & Local Data** → All default products, KB entries, and `localStorage` hooks implemented exactly?
3.  **AI Flows** → All Genkit flows implemented with correct schemas, prompts, and fallback logic?
4.  **Voice Agent** → Turn-taking, barge-in, silence/inactivity detection, and TTS/ASR logic fully functional?
5.  **Dashboards & Exports** → All dashboards display correct data and all Excel/PDF/DOC exports are working?
6.  **Configs & Components** → `tailwind.config.ts`, `globals.css`, and all ShadCN components correctly configured?
7.  **Environment** → Instructions for `.env` file with `GOOGLE_API_KEY` and `NEXT_PUBLIC_GOOGLE_API_KEY` are clear and implemented?
8.  **API Routes** → `/api/clone-app`, `/api/clone-docs`, and `/api/n8n-workflow` are fully implemented and functional?

Stop only when **all items are PASS**.

---
## ⚠️ Final Directives
- **No hallucination. No summarization. No stubs.**
- Must output every single line of code as derived from the application context.
- Must replicate the entire application state, including the default KB and product catalog.
- The final deliverable must be a **100% identical, deployable app** (Vercel/Firebase ready).
