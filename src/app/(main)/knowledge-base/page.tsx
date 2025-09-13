
"use client";

import { KnowledgeBaseForm, RawKnowledgeEntry, RawTextKnowledgeEntry } from "@/components/features/knowledge-base/knowledge-base-form";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { useActivityLogger } from "@/hooks/use-activity-logger";
import { exportPlainTextFile } from "@/lib/export";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


const ALL_PROMPTS_TEXT = `
// =================================================================================================
//
//                        AI_TeleSuite: Full Implementation Logic & AI Prompts
//
// This document provides a comprehensive technical breakdown of every feature in the AI_TeleSuite
// application. It is intended as a complete guide for replication and understanding the system's
// architecture, data flow, and AI logic.
//
// Note: Handlebars syntax (e.g., {{{variable}}}, {{#if condition}}...{{/if}}) is used for
// templating in AI prompts.
//
// =================================================================================================


// ==================================================
//               CORE APPLICATION & UI
// ==================================================

/*
** Home Page ('/home') **
- **Purpose:** A central dashboard providing an at-a-glance overview of all application modules.
- **Implementation:** Uses a series of "Feature Widgets". Each widget is a \`<Card>\` component that links to a specific feature page.
- **Data Fetching:** Each widget's data is dynamically calculated on the client-side using hooks like \`useActivityLogger\`, \`useKnowledgeBase\`, and \`useProductContext\` to show statistics (e.g., "Pitches Generated", "KB Entries") and the last activity time. The UI is client-rendered (\`"use client"\`) to prevent hydration errors from localStorage access.

** Products ('/products') **
- **Purpose:** Manage the product catalog that other features use for context.
- **Implementation:** A page displaying a table of \`ProductObject\` items. It uses \`useProductContext\` to interact with \`localStorage\`.
- **Logic:**
    1.  The \`ProductProvider\` wraps the application, managing an array of \`ProductObject\`s in \`localStorage\`.
    2.  The page allows adding, editing, and deleting products (except for the default ones: "ET", "TOI", "General").
    3.  A "Generate with AI" button calls the \`generateProductDescription\` flow to auto-populate the description field.

** Sidebar Navigation ('/components/layout/app-sidebar.tsx') **
- **Purpose:** Provides navigation through a collapsible, accordion-style menu.
- **Implementation:** Uses ShadCN's \`<Accordion>\` and custom \`<Sidebar>\` components. The navigation structure is a statically defined array of objects in the component.
- **Logic:** It uses the \`usePathname\` hook to determine the currently active link and group, automatically expanding the relevant accordion section. It also manages a loading overlay during page transitions.
*/


// ==================================================
//           KNOWLEDGE BASE & CONTENT TOOLS
// ==================================================

/*
** Add Knowledge Base Entry ('/knowledge-base') **
- **Purpose:** The primary interface for adding new information (files or text) to the knowledge base.
- **Implementation:** A form built with \`react-hook-form\` and \`zod\` for validation.
- **Logic:**
    1.  The user selects a product, category, and entry type (file or text).
    2.  For files, it reads the metadata and generates a \`dataUri\` for session use (preview/download), but this URI is NOT persisted to \`localStorage\` to save space.
    3.  For text entries, it captures the user-provided title and content.
    4.  On submission, it calls the \`useKnowledgeBase\` hook's \`addFile\` or \`addFilesBatch\` function, which persists the new \`KnowledgeFile\` object(s) to \`localStorage\`.
    5.  The table of all KB entries is displayed below the form for immediate reference.
*/

// --- Prompt: Download AI Prompts --- //
// This is the static text content downloaded from the "Download AI Prompts" button. It is a meta-feature to allow users to inspect the system's core logic. The content below is what gets exported.

// ... The full, detailed prompt text as it was before ...

/*
** Training Material Creator ('/create-training-deck') **
- **Purpose:** Generates structured text content for training materials.
- **Implementation:** A form allows the user to select a product and format, and provide context via three methods: a direct prompt, file uploads, or selecting existing KB items.
- **Logic:**
    1.  The frontend gathers the chosen context and packages it into a \`GenerateTrainingDeckInput\` object.
    2.  The \`generateTrainingDeck\` Genkit flow is called.
    3.  The AI is instructed to act as a "presentation specialist" and use a specific framework if the request matches predefined cases (e.g., "ET Prime Sales Deck"). Otherwise, it performs a general synthesis of the provided context.
    4.  The output is a structured \`GenerateTrainingDeckOutput\` object, which is then displayed in an accordion view on the frontend.
*/

// --- Prompt: Training Deck Generator --- //
// You are a presentation and documentation specialist trained to create professional training material...
// ... [Full prompt from training-deck-generator.ts] ...

/*
** Batch Audio Downloader ('/batch-audio-downloader') **
- **Purpose:** Allows downloading multiple audio files from URLs and bundling them into a ZIP archive.
- **Implementation:** A client-side utility using the \`jszip\` and \`xlsx\` libraries.
- **Logic:**
    1.  The user can either paste a list of URLs or upload an Excel file.
    2.  If Excel is used, the \`xlsx\` library parses the specified sheet and column to extract URLs.
    3.  The frontend then iterates through the URLs, fetching each audio file as a blob using the \`fetch\` API.
    4.  **CORS Handling:** A critical note is displayed to the user, explaining that success is dependent on the external server's CORS policy. Errors due to CORS are caught and displayed.
    5.  Successful blobs are added to a \`JSZip\` instance.
    6.  Finally, \`zip.generateAsync()\` creates the final ZIP blob, which is then triggered for download.
*/

/*
** AI Data Analyst ('/data-analysis') **
- **Purpose:** Simulates a data analysis expert to provide insights based on user descriptions of their data files.
- **Implementation:** A form where the user "uploads" files (only metadata is used for most) and provides a detailed text prompt.
- **Logic:**
    1.  This feature is a **simulation**. The AI does **not** process the full binary content of large files like Excel.
    2.  The user's \`userAnalysisPrompt\` is the most critical input. They must describe the data's structure, columns, decoding rules, and their analytical goals.
    3.  The \`analyzeData\` Genkit flow is called with the file metadata and the user's prompt.
    4.  The AI is given an extensive prompt instructing it to act as an "advanced Excel analyst". It simulates data cleaning, KPI calculation, and insight generation based *only* on the user's description.
    5.  The final report includes a **critical disclaimer** that the analysis is a simulation based on textual descriptions.
*/

// --- Prompt: AI Data Analyst --- //
// You are an advanced Excel analyst AI, specializing in telesales and subscription operations...
// ... [Full prompt from data-analyzer.ts] ...


// ==================================================
//                 SALES TOOLS
// ==================================================

/*
** AI Pitch Generator ('/pitch-generator') **
- **Purpose:** Generates structured, high-quality sales pitches.
- **Implementation:** A form to select product, cohort, and other details. Can optionally take a direct file upload for context.
- **Logic:**
    1.  The frontend prepares a \`knowledgeBaseContext\` string. If a direct file is uploaded, its context is prioritized.
    2.  The \`generatePitch\` Genkit flow is called.
    3.  The AI is instructed to follow strict rules, using specific KB categories ('Pitch', 'Product Description', 'Pricing') for specific parts of the generated pitch, ensuring factual accuracy and correct flow. It is authorized to browse the product's official URL as a fallback.
    4.  The AI's output is a structured \`GeneratePitchOutput\` object, displayed in a dedicated \`PitchCard\` component.
*/

// --- Prompt: Pitch Generator --- //
// You are a world-class sales agent... You MUST base your entire response exclusively on the information provided in the structured 'Knowledge Base Context'...
// ... [Full prompt from pitch-generator.ts] ...

/*
** AI Rebuttal Assistant ('/rebuttal-generator') **
- **Purpose:** Provides contextual rebuttals to customer objections.
- **Implementation:** A simple form for the user to enter an objection for a selected product.
- **Logic:**
    1.  Calls the \`generateRebuttal\` Genkit flow.
    2.  The AI is prompted to follow an "Acknowledge, Bridge, Benefit, Clarify/Question" (ABBC/Q) structure.
    3.  **Resilience:** This flow includes a non-AI, rule-based fallback (\`generateFallbackRebuttal\`). If the AI service fails for any reason, this function uses keyword matching and high-quality templates to generate a reasonable rebuttal, ensuring high availability.
*/

// --- Prompt: Rebuttal Generator --- //
// You are a world-class sales coach and linguist... Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context'...
// ... [Full prompt from rebuttal-generator.ts] ...

/*
** AI Voice Sales Agent ('/voice-sales-agent') **
- **Purpose:** Orchestrates a full, simulated voice-to-voice sales call.
- **Implementation:** A complex client-side component that manages the call state machine ("CONFIGURING", "LISTENING", "PROCESSING", "AI_SPEAKING", "ENDED"). It integrates the \`useWhisper\` hook for ASR and a client-side TTS utility.
- **Logic:**
    1.  **Start:** On starting, it calls the \`runVoiceSalesAgentTurn\` flow with \`action: 'START_CONVERSATION'\`. This internally calls \`generatePitch\` to get the full script. The intro is then synthesized and played.
    2.  **User Input:** The \`useWhisper\` hook handles user speech. It is configured for low-latency silence detection (~50ms) to enable quick turn-taking. **Barge-in** is implemented by having the ASR callback immediately call a function to stop any ongoing TTS playback.
    3.  **Agent Response:** The user's transcribed input is sent to the \`runVoiceSalesAgentTurn\` flow with \`action: 'PROCESS_USER_RESPONSE'\`.
    4.  **Routing:** Inside the flow, a fast "router" prompt categorizes the user's intent (e.g., 'CONTINUE_PITCH', 'ANSWER_SALES_QUESTION', 'HANDLE_SALES_OBJECTION').
    5.  Based on the route, the flow either selects the next part of the pre-generated pitch or calls a specialized, smaller prompt to generate a contextual answer from the KB. This ensures responses are fast and relevant.
    6.  **Inactivity:** An inactivity timer is managed on the client. If no speech is detected for ~3 seconds after the agent finishes speaking, it triggers a reminder turn.
    7.  **End Call:** When the call ends, a full transcript is constructed, a complete audio file of the conversation is generated, and the \`scoreCall\` flow is triggered to analyze the interaction. All artifacts are logged.
*/

// --- Prompts: Voice Sales Agent (Router, Answer Generators) --- //
// Router Prompt
// You are an AI sales agent controller... Analyze the user's last response... and decide the next logical action...
// Sales Answer Prompt
// You are a helpful AI sales assistant... Use the provided Knowledge Base context to answer...
// Support Answer Prompt
// You are a crisp, factual AI support assistant... Use the provided Knowledge Base context to provide a clear, direct answer...
// ... [Full prompts from voice-sales-agent-flow.ts] ...


// ==================================================
//               SUPPORT & ANALYSIS TOOLS
// ==================================================

/*
** AI Voice Support Agent ('/voice-support-agent') **
- **Purpose:** A voice-based agent focused on answering support queries.
- **Logic:** Similar to the sales agent but simpler. It uses the \`runVoiceSupportAgentQuery\` flow. The AI is prompted to answer factually based on the KB and to identify when a query requires live data or escalation to a human, setting flags in the output accordingly.

** Call Transcription ('/transcription') **
- **Purpose:** High-accuracy audio-to-text conversion.
- **Logic:**
    1.  The \`transcribeAudio\` Genkit flow is called with the audio file's data URI.
    2.  The prompt gives strict instructions for **English (Roman script) only**, transliteration of Hinglish, diarization with only "AGENT:" and "USER:" labels, and exclusion of all non-dialogue sounds (IVR, ringing).
    3.  **Resilience:** The flow uses a dual-model strategy. It first tries a fast model (\`gemini-2.0-flash\`). If that fails (due to errors or rate limits), it automatically retries with a more powerful model (\`gemini-1.5-flash-latest\`). This ensures high success rates.

** AI Call Scoring ('/call-scoring') **
- **Purpose:** Provides a deep, rubric-based analysis of a call.
- **Logic:**
    1.  The \`scoreCall\` flow is called with a transcript and product context.
    2.  The AI is prompted to act as an "EXHAUSTIVE and DEEPLY ANALYTICAL" quality analyst.
    3.  The prompt contains a detailed rubric with over 75 specific metrics that the AI **must** score and provide feedback for.
    4.  **Resilience:** This flow also has a two-tiered system. The primary model (\`gemini-1.5-flash-latest\`) attempts the deep analysis. If it fails after retries, a backup model (\`gemini-2.0-flash\`) is called with a simpler prompt to provide a high-level summary, ensuring a result is always returned.

** Combined Call Analysis ('/combined-call-analysis') **
- **Purpose:** Aggregates multiple call scoring reports to find trends.
- **Logic:**
    1.  The frontend fetches all historical scoring reports for a selected product from the activity log.
    2.  This batch of reports is sent to the \`analyzeCallBatch\` Genkit flow.
    3.  The AI is instructed to act as a "call quality supervisor and data analyst" and synthesize the information to find common strengths, weaknesses, themes, and calculate an average score.
    4.  **Pitch Optimization:** This page includes a feature to call \`generateOptimizedPitches\`. This second flow takes the output of the combined analysis and uses it as an "optimization context" to guide the main pitch generator, creating new pitches that are refined based on the observed batch performance.

// --- Prompts: Transcription, Scoring, Combined Analysis --- //
// Transcription
// You are an expert transcriptionist... IGNORE ALL NON-SPEECH SOUNDS... Diarization and Speaker Labels (CRITICAL - AGENT/USER ONLY)...
// Call Scoring (Deep Analysis)
// You are an EXHAUSTIVE and DEEPLY ANALYTICAL telesales call quality analyst... EVALUATION RUBRIC (Metrics to score): ... Intro Hook Line... Opening Greeting...
// Combined Analysis
// You are an expert call quality supervisor and data analyst... Your primary goal is to provide actionable insights that directly answer: 1. What specific agent behaviors and script elements are successfully driving revenue...? 2. What specific changes must be made...?
// ... [Full prompts from the respective flow files] ...


// ==================================================
//                 SYSTEM & DASHBOARDS
// ==================================================

/*
** All Dashboards (e.g., '/call-scoring-dashboard') **
- **Purpose:** To view historical activity for a specific module.
- **Implementation:** All dashboards are client components that use the \`useActivityLogger\` hook to read data from \`localStorage\`.
- **Logic:**
    1.  Fetch all activities from the hook.
    2.  Filter the activities based on the dashboard's specific \`module\` (e.g., "Call Scoring", "Data Analysis").
    3.  Render the filtered data in a ShadCN \`<Table>\`.
    4.  A "View Details" button opens a \`<Dialog>\` component, which often reuses the primary feature's results card (e.g., \`CallScoringResultsCard\`) to display the full details of the logged event.
    5.  All dashboards provide data export functionality (CSV, PDF, DOC) via the utility functions in \`/src/lib/export.ts\`.

** Global Activity Log ('/activity-dashboard') **
- **Purpose:** A master log of all significant user actions across the entire application.
- **Implementation:** Similar to other dashboards but without a module filter. It includes more advanced filtering options for date, agent, module, and product.
- **Logic:** It reads the full activity log from \`useActivityLogger\` and provides a searchable, filterable view of everything that has happened.
*/

// --- End of AI_TeleSuite Implementation Logic --- //
`;

export default function KnowledgeBaseManagementPage() {
  const { files, addFile, addFilesBatch, deleteFile, setFiles } = useKnowledgeBase();
  const { logActivity } = useActivityLogger();
  const { toast } = useToast();
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddSingleEntry = async (entry: RawTextKnowledgeEntry) => {
    const newEntry = await addFile(entry);
    logActivity({
      module: "Knowledge Base Management",
      product: newEntry.product,
      details: { action: "add", ...newEntry }
    });
  };

  const handleAddMultipleFiles = async (entries: RawKnowledgeEntry[]) => {
    const newEntries = await addFilesBatch(entries);
    logActivity({
      module: "Knowledge Base Management",
      product: newEntries[0]?.product,
      details: { action: "add_batch", filesData: newEntries.map(f => ({ name: f.name, type: f.type, size: f.size })) }
    });
  };

  const handleDeleteFile = (fileId: string) => {
    const fileName = files.find(f => f.id === fileId)?.name || "Unknown file";
    deleteFile(fileId);
    toast({
      title: "Entry Deleted",
      description: `"${fileName}" has been removed from the knowledge base.`,
    });
     logActivity({
        module: "Knowledge Base Management",
        details: { action: "delete", fileId, name: fileName }
    });
  };

  const handleClearAllKnowledgeBase = () => {
    const count = files.length;
    setFiles([]);
    toast({
      title: "Knowledge Base Cleared",
      description: `${count} entr(y/ies) have been removed.`,
    });
    logActivity({
        module: "Knowledge Base Management",
        details: { action: "clear_all", countCleared: count }
    });
    setIsClearAlertOpen(false);
  };

  const handleDownloadFullPrompts = () => {
    exportPlainTextFile("AI_TeleSuite_Full_Prompts_Logic.txt", ALL_PROMPTS_TEXT);
    logActivity({ module: "Knowledge Base Management", details: { action: "download_full_prompts" } });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm
          onSingleEntrySubmit={handleAddSingleEntry}
          onMultipleFilesSubmit={handleAddMultipleFiles}
        />
        <div className="w-full max-w-4xl flex justify-between items-center mt-8">
            <h2 className="text-xl font-semibold text-primary">Knowledge Base Dashboard</h2>
            <div className="flex gap-2">
                <Button onClick={handleDownloadFullPrompts} variant="outline">
                    <Download className="mr-2 h-4 w-4" /> Download AI Prompts
                </Button>
                <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={!isClient || !files || files.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" /> Clear All Entries
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete all ({files?.length || 0}) entries from your knowledge base.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearAllKnowledgeBase} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete all
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
        <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
      </main>
    </div>
  );
}

    