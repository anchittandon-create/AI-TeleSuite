# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Index

This document serves as the master index for the complete, multi-part replication specification for the AI_TeleSuite application (v1.1). Due to its comprehensive nature, the full prompt has been broken down into multiple files located in the `/src/replication/` directory.

To build a 100% identical clone of this application, an AI agent or developer must process the following specification documents in order.

---

### **Replication Specification Files**

*   **Part 1: Core Setup & Configuration**
    *   **File:** [`/src/replication/01_setup_and_config.md`](./src/replication/01_setup_and_config.md)
    *   **Contents:** Core technology stack, project setup, environment variables, and the full code for all root-level configuration files (`package.json`, `tailwind.config.ts`, `next.config.js`, etc.).

*   **Part 2: Global Styles & Layout**
    *   **File:** [`/src/replication/02_styles_and_layout.md`](./src/replication/02_styles_and_layout.md)
    *   **Contents:** Full code for `globals.css`, the root `layout.tsx`, the main authenticated `layout.tsx`, and core layout components like the sidebar and page header.

*   **Part 3: UI Components**
    *   **File:** [`/src/replication/03_ui_components.md`](./src/replication/03_ui_components.md)
    *   **Contents:** A complete reference to all ShadCN UI components. As these are standard library components, this section confirms their presence and configuration via `components.json`.

*   **Part 4: Custom Hooks & Client-Side State**
    *   **File:** [`/src/replication/04_hooks_and_state.md`](./src/replication/04_hooks_and_state.md)
    *   **Contents:** Full implementation of all custom React hooks, including `useLocalStorage`, `useActivityLogger`, `useProductContext`, `useKnowledgeBase`, and `useWhisper`. This section includes the initial data state for products and the knowledge base.

*   **Part 5: Core Library Utilities**
    *   **File:** [`/src/replication/05_library_utils.md`](./src/replication/05_library_utils.md)
    *   **Contents:** Full code for all utility functions in the `/src/lib/` directory, including PDF/export helpers and the client-side TTS utility.

*   **Part 6: AI Flows & Backend Logic**
    *   **File:** [`/src/replication/06_ai_flows.md`](./src/replication/06_ai_flows.md)
    *   **Contents:** The complete implementation of every Genkit AI flow, including all prompts, Zod schemas, and fallback logic for every feature.

*   **Part 7: Feature Pages & Components**
    *   **File:** [`/src/replication/07_feature_pages.md`](./src/replication/07_feature_pages.md)
    *   **Contents:** The full code for every application page (`page.tsx`) and all feature-specific components located under `/src/components/features/`. This is the largest section, detailing the frontend implementation of every tool.

*   **Part 8: API Routes**
    *   **File:** [`/src/replication/08_api_routes.md`](./src/replication/08_api_routes.md)
    *   **Contents:** The implementation for server-side API routes, such as the dynamic project cloner.

---

This structured approach ensures that the entire specification is delivered reliably and completely, overcoming any single-file size limitations.