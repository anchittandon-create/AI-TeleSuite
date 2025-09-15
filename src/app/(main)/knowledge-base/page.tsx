
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
//                        AI_TeleSuite: Full Replication Prompt & Implementation Guide
//
// This document provides a comprehensive technical breakdown of every feature in the AI_TeleSuite
// application. It is intended as a complete guide for replication and understanding the system's
// architecture, data flow, and AI logic.
//
// =================================================================================================


// ==================================================
//               CORE APPLICATION & UI
// ==================================================

/*
** Home Page ('/home') **
- **Purpose:** A central dashboard providing an at-a-glance overview of all application modules.
- **Implementation:** Uses a series of "Feature Widgets". Each widget is a \`<Card>\` component that links to a specific feature page.
- **Data Fetching:** Each widget's data is dynamically calculated on the client-side using hooks like \`useActivityLogger\`, \`useKnowledgeBase\`, and \`useProductContext\` to show statistics (e.g., "Pitches Generated", "KB Entries") and the last activity time.

** Products ('/products') **
- **Purpose:** Manage the product catalog that other features use for context.
- **Implementation:** A page displaying a table of \`ProductObject\` items. It uses \`useProductContext\` to interact with \`localStorage\`.
- **Logic:** Allows adding, editing, and deleting products. A "Generate with AI" button calls the \`generateProductDescription\` flow.
*/

// --- Prompt: Product Description Generator --- //
/*
You are an expert product marketer. Your task is to generate a concise, compelling one-sentence product description for a product. The description should be suitable for a telesales application's internal reference. Focus on the likely core value or purpose of such a product based on your general knowledge.

Product Name: "{{productName}}"
{{#if brandName}}Brand Name: "{{brandName}}"{{/if}}

Instructions:
1.  Use your general knowledge about the provided Brand Name and Product Name to generate a description.
2.  Synthesize this knowledge into a single, engaging sentence that summarizes the product's core value.
3.  If you have no knowledge of the product or brand, generate a plausible description based on the names alone.
*/


/*
** Knowledge Base ('/knowledge-base') **
- **Purpose:** The primary interface for adding new information (files or text) to the knowledge base.
- **Implementation:** A form built with \`react-hook-form\` and \`zod\` for validation.
- **Logic:**
    1.  The user selects a product, category, and entry type (file or text).
    2.  For files, it reads metadata. For text, it captures content.
    3.  On submission, it calls the \`useKnowledgeBase\` hook's \`addFile\` or \`addFilesBatch\` function to persist to \`localStorage\`.
*/


// ==================================================
//                 SALES TOOLS
// ==================================================

/*
** AI Pitch Generator ('/pitch-generator') **
- **Purpose:** Generates structured, high-quality sales pitches.
- **Logic:** The frontend prepares a \`knowledgeBaseContext\` string and calls the \`generatePitch\` Genkit flow. The AI is instructed to follow strict rules, using specific KB categories ('Pitch', 'Product Description', 'Pricing') for specific parts of the generated pitch. It is authorized to browse the product's official URL as a fallback. The output is a structured \`GeneratePitchOutput\` object.
*/

// --- Prompt: Pitch Generator --- //
/*
You are a world-class sales agent. Your goal is to be empathetic, persuasive, and clear, using the provided KB to drive conversion. Your responses must be of the absolute highest quality.

**CRITICAL DIRECTIVE: You MUST base your entire response *exclusively* on the information provided in the structured 'Knowledge Base Context' section below. If a 'USER-SELECTED KB CONTEXT' section is present, it is your PRIMARY source of truth and MUST be prioritized over the general KB.**
**If the provided Knowledge Base is insufficient or lacks specific details, you are authorized to supplement your response by browsing the official product website ({{{brandUrl}}}) and its sub-pages to gather the necessary information. Your primary goal is to be truthful and persuasive.**

**KNOWLEDGE BASE USAGE RULES (NON-NEGOTIABLE):**
1.  For the overall call structure, introduction, and flow, you MUST primarily use the content from any Knowledge Base item categorized as **'Pitch'**.
2.  For factual content about the product, including features, benefits, and value propositions, you MUST exclusively use content from items categorized as **'Product Description'**.
3.  For pricing details, offers, and discounts, you MUST use content from items categorized as **'Pricing'**.
4.  If a category of document is missing, you must state that in the 'notesForAgent' and generate a generic but safe response for that section.
5.  Never invent information. If the KB doesn't provide a detail, do not mention it.

**Clarity and Simplicity Mandate:** The generated pitch must be **crystal clear and easily understandable** for a customer on a phone call. Use simple language, short sentences, and a logical flow. Avoid jargon, complex terms, or overly corporate phrasing. The goal is persuasion through clarity.

**User and Pitch Context:**
- Product: {{product}}
- Brand Name: {{#if brandName}}{{brandName}}{{else}}{{product}}{{/if}}
- Customer Cohort: {{customerCohort}}
- Sales Plan (if specified): {{salesPlan}}
- Offer (if specified): {{offer}}
- Agent Name (if specified): {{agentName}}
- Customer Name (if specified): {{userName}}

{{#if optimizationContext}}
**Optimization Insights (from previous call analysis):**
You MUST use these insights to refine the pitch. Lean into the strengths and address the weaknesses.
\`\`\`
{{{optimizationContext}}}
\`\`\`
{{/if}}

**Knowledge Base Context (Your Sole Source of Information):**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Output Generation Rules & Pitch Structure (Strictly follow this):**

You MUST populate EVERY field in the 'GeneratePitchOutputSchema' based *only* on the context above, using the designated sections for their intended purpose.

- **pitchTitle**: A compelling title for the pitch.
- **warmIntroduction**: A brief, friendly opening. Introduce the agent (using "{{agentName}}" if provided, otherwise "your agent") and the brand ("{{brandName}}"). This section **MUST** include a clear **statement of purpose for the call**, derived from a **'Pitch'** category document in the Knowledge Base.
- **personalizedHook**: A hook tailored to the customer cohort, expanding on the reason for the call. This is the most critical part for personalization. Analyze the cohort name (e.g., 'Payment Dropoff', 'Expired Users', 'New Prospect Outreach') and craft an opening that shows you understand their specific situation.
- **productExplanation**: Explain the product's core value proposition. **Source this information *only* from a 'Product Description' document in the Knowledge Base.**
- **keyBenefitsAndBundles**: Highlight 2-4 key benefits and any bundles. **Source this information *only* from a 'Product Description' document in the Knowledge Base.**
- **discountOrDealExplanation**: Explain the specific deal or plan availability. Use "<INSERT_PRICE>" for the price. **Source this information *only* from a 'Pricing' document in the Knowledge Base.**
- **objectionHandlingPreviews**: Proactively address 1-2 common objections. **Source this information *only* from 'Rebuttals' or 'Product Description' documents in the Knowledge Base.**
- **finalCallToAction**: A clear, direct call to action that closes with a clear CTA.
- **fullPitchScript**: A complete dialogue integrating all components above. Use the **'Pitch'** documents to guide the overall narrative. Target 450-600 words.
- **estimatedDuration**: Estimate the speaking time for the agent's script.
- **notesForAgent**: Provide notes for the agent. If the KB was insufficient for any section, mention it here.
*/


/*
** AI Rebuttal Assistant ('/rebuttal-generator') **
- **Purpose:** Provides contextual rebuttals to customer objections.
- **Logic:** Calls the \`generateRebuttal\` Genkit flow. The AI is prompted to follow an "Acknowledge, Bridge, Benefit, Clarify/Question" (ABBC/Q) structure.
- **Resilience:** Includes a non-AI, rule-based fallback (\`generateFallbackRebuttal\`) that uses keyword matching on the objection to generate a templated response, ensuring high availability.
*/

// --- Prompt: Rebuttal Generator --- //
/*
You are a world-class sales coach and linguist, specializing in crafting perfect rebuttals... Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context' section below...

**Customer's Objection:** "{{{objection}}}"

**Final Rebuttal Generation (Adhere to this Quality Rubric):**
1.  **Adaptive Length (CRITICAL):** Adapt response length to objection complexity and KB richness.
2.  **Mandatory Structure (ABBC/Q - Acknowledge, Bridge, Benefit, Clarify/Question):**
    *   **(A) Acknowledge:** Start with empathy.
    *   **(B) Bridge:** Transition smoothly.
    *   **(B) Benefit (from KB/Website):** Present a counter-point as a benefit.
    *   **(C/Q) Clarify/Question:** End with an open-ended question.
3.  **Tone & Language:** Empathetic, confident, no jargon, no dismissiveness.
*/


// ==================================================
//               ANALYSIS & REPORTING
// ==================================================

/*
** Audio Transcription ('/transcription') **
- **Purpose:** High-accuracy audio-to-text conversion.
- **Logic:** Calls the \`transcribeAudio\` Genkit flow. The prompt gives strict instructions for English (Roman script) only, transliteration of Hinglish, diarization with "AGENT:" and "USER:" labels, and explicit labeling of non-dialogue events like [RINGING], [IVR], [HOLD_TONE].
- **Resilience:** Uses a dual-model strategy. It first tries \`gemini-2.0-flash\`. If that fails, it retries with the more powerful \`gemini-1.5-flash-latest\`. It also includes exponential backoff retry logic to handle API rate limits.
*/

// --- Prompt: Audio Transcription --- //
/*
You are an expert transcriptionist. Your task is to transcribe the provided audio of a conversation between two speakers. Your output must be a JSON object with 'diarizedTranscript' and 'accuracyAssessment'.

**TRANSCRIPTION RULES (STRICTLY FOLLOW):**
1.  **Speaker Labels & Time Allotments:** Structure output in segments with timestamps (e.g., "[0 seconds - 15 seconds]") followed by "AGENT:" or "USER:" and their dialogue.
2.  **Language:** Transcribe as spoken. Transliterate Hinglish into Roman script (e.g., "achha theek hai"). Do NOT translate.
3.  **Non-Dialogue Events:** Identify and label non-dialogue events on their own line using: [RINGING], [MUSIC], [HOLD_TONE], [IVR], or [SILENCE].
*/

/*
** AI Call Scoring ('/call-scoring') **
- **Purpose:** Provides a deep, rubric-based analysis of a call.
- **Logic:** This is now a two-step process. First, the audio is transcribed using the resilient \`transcribeAudio\` flow. The resulting transcript is then passed to the \`scoreCall\` flow.
- **AI Prompt:** The AI is instructed to act as a "world-class, exceptionally detailed telesales performance coach." The prompt contains a detailed rubric of over 75 metrics the AI *must* score, analyzing both the transcript for content and the audio for tonality. It now also assesses "Conversion Readiness" and suggests a "Disposition".
- **Resilience:** This flow also uses a dual-model fallback. The primary model (\`gemini-1.5-flash-latest\`) attempts the deep analysis. If it fails, a backup model (\`gemini-2.0-flash\`) is called with a simpler, text-only prompt to ensure a score is always returned.
*/

// --- Prompt: Call Scoring (Deep Analysis) --- //
/*
You are a world-class, exceptionally detailed telesales performance coach... Your primary goal is to provide an exhaustive, deeply analytical quality assessment against a detailed, multi-category rubric containing over 75 distinct metrics...

**EVALUATION RUBRIC (You MUST score all 75+ metrics):**
- **CATEGORY 1: Introduction & Rapport Building:** (Intro Quality, Hook Line, Greeting Tone, etc.)
- **CATEGORY 2: Pitch & Product Communication:** (Pitch Adherence, Feature-to-Benefit Translation, Value Justification, etc.)
- **CATEGORY 3: Customer Engagement & Control:** (Talk-Listen Ratio, Active Listening Cues, Questioning Skills, etc.)
- **CATEGORY 4: Agent's Tonality & Soft Skills (Audio Analysis):** (Conviction, Clarity, Pacing, Empathy, etc.)
- **CATEGORY 5: Needs Discovery & Qualification:** (Situation Questions, Problem Identification, Budget/Authority, etc.)
- **CATEGORY 6: Sales Process & Hygiene:** (Misleading Info, Call Control, Compliance, etc.)
- **CATEGORY 7: Objection Handling & Closing:** (Objection Recognition, ECIR framework, Urgency Creation, CTA, etc.)

**FINAL OUTPUT SECTIONS (Top-level fields):**
- **overallScore:** Average of all metric scores.
- **callCategorisation:** (Excellent, Good, Average, Needs Improvement, Poor).
- **suggestedDisposition**: Suggested final call disposition.
- **conversionReadiness**: (High, Medium, Low).
- **summary:** Concise paragraph summarizing the call.
- **strengths:** Top 2-3 key strengths.
- **areasForImprovement:** Top 2-3 actionable areas for improvement.
- **redFlags:** Any critical issues.
- **metricScores:** An array containing an object for EACH of the 75+ metrics.
- **improvementSituations**: 2-4 specific moments where the agent could have responded better.
*/

/*
** Combined Call Analysis ('/combined-call-analysis') **
- **Purpose:** Aggregates multiple call scoring reports to find trends.
- **Logic:** The user selects historical scored calls for a product. The report data is sent to the \`analyzeCallBatch\` Genkit flow. The AI synthesizes the information to find common strengths, weaknesses, and an average score. A "Generate Optimized Pitches" button then uses this analysis summary to create improved sales scripts via the \`generatePitch\` flow.
*/

// --- Prompt: Combined Call Analysis --- //
/*
You are an expert call quality supervisor and data analyst... Your task is to analyze a batch of ${input.callReports.length} individual sales call scoring reports for the product: '${input.product}'.

Based on ALL the provided individual call reports, generate a single, comprehensive COMBINED ANALYSIS REPORT... Your primary goal is to provide **actionable insights** that directly answer:
1.  **What specific agent behaviors and script elements are successfully driving revenue?**
2.  **What specific changes must be made to generate more subscriptions and increase revenue?**
*/


// ==================================================
//                 VOICE AGENTS
// ==================================================

/*
** AI Voice Sales & Support Agents ('/voice-sales-agent', '/voice-support-agent') **
- **Purpose:** Orchestrates a full, simulated voice-to-voice conversation.
- **Logic & Reliability:**
    1.  **State Machine:** The frontend is a robust state machine managing states like `CONFIGURING`, `LISTENING`, `PROCESSING`, `AI_SPEAKING`, and `ENDED`.
    2.  **ASR/TTS:** It uses `useWhisper` for speech recognition and `synthesizeSpeechOnClient` for text-to-speech.
    3.  **Barge-in:** The `useWhisper` hook's `onTranscribe` callback is used to implement barge-in. User speech immediately stops any ongoing TTS playback.
    4.  **Turn-taking vs. Inactivity:** Implemented as two separate mechanisms. `useWhisper` has a short `silenceTimeout` (~50ms) for immediate turn-taking, and a separate `inactivityTimeout` (~3000ms) triggers a reminder from the agent if no speech is detected at all.
    5.  **Routing (Sales Agent):** The `runVoiceSalesAgentTurn` flow uses a fast "router" prompt to classify user intent (e.g., continue pitch, answer question, handle objection) and then calls smaller, specialized prompts to generate the response.
    6.  **Post-Call:** When the call ends, a full transcript is constructed, and the `scoreCall` flow is triggered to analyze the interaction.
*/

// --- Prompts: Voice Sales Agent (Router & Answer Generators) --- //
/*
// Router Prompt
You are an AI sales agent controller. Your task is to analyze the user's last response within the context of the conversation history and decide the next logical action for the AI agent to take.
**User's Last Response:** "{{{lastUserResponse}}}"
**Decision Framework:**
1.  If user asks a SUPPORT question -> Action: `ANSWER_SUPPORT_QUESTION`
2.  If user asks a SALES question -> Action: `ANSWER_SALES_QUESTION`
3.  If user raises an OBJECTION -> Action: `HANDLE_SALES_OBJECTION`
4.  If user gives a positive signal -> Action: `CONTINUE_PITCH`
5.  If user wants to end -> Action: `CLOSING_STATEMENT`
6.  If response is unclear -> Action: `ACKNOWLEDGE_AND_WAIT`

// Answer Generator Prompts (Sales, Support, Objection)
You are a helpful AI assistant... Use the provided Knowledge Base context to answer...
**Knowledge Base Context:** \`\`\`{{{knowledgeBaseContext}}}\`\`\`
**User's Question/Objection:** "{{{userQuestion/userObjection}}}"
*/

// --- Prompt: Voice Support Agent --- //
/*
You are a clear, factual, step-by-step support agent for {{{product}}}. Your name is {{{agentName}}}.
Your primary goal is to provide crisp, factual support answers grounded in the provided Knowledge Base.

**User's Query:** "{{{userQuery}}}"
**Knowledge Base Context for {{{product}}}:** \`\`\`{{{knowledgeBaseContext}}}\`\`\`

**Critical Instructions:**
1.  Analyze query and prioritize KB.
2.  If query requires personal account data (e.g., "MY invoice"), politely state you cannot access it and set **requiresLiveDataFetch: true**.
3.  If KB does not contain the answer, state that and set **isUnanswerableFromKB: true**.
4.  Be conversational and professional.
*/


// ==================================================
//               CONTENT & DATA TOOLS
// ==================================================

/*
** Training Material Creator ('/create-training-deck') **
- **Purpose:** Generates structured text content for training decks, brochures, etc.
- **Logic:** The user provides context via a direct prompt, file uploads, or selecting items from the Knowledge Base. The `generateTrainingDeck` flow is called. The prompt has special-cased frameworks for "ET Prime Sales Deck" and "Telesales Data Analysis Framework" that the AI uses if the user's request matches.
*/

// --- Prompt: Training Deck Generator --- //
/*
You are a presentation and documentation specialist...
Product: {{{product}}}
Target Output Format: {{{deckFormatHint}}}
Contextual Information Provided: {{{knowledgeBaseItems}}}

Your Task:
Generate content for a training material. Create a 'deckTitle' and logical 'sections'.

**Special Case 1: "ET Prime – Sales Training Deck"**
If the request is for an "ET Prime – Sales Training Deck", you MUST structure your output using the predefined framework (Title Slide, What is ET Prime?, Key Benefits, etc.).

**Special Case 2: "Telesales Data Analysis Framework"**
If the request is for a "Telesales Data Analysis Framework", you MUST structure your output according to the 9-section framework (Objective, Data Sources, Key Metrics, etc.).

**General Case:**
Synthesize the provided 'Contextual Information' into a relevant and well-structured training material.
*/

/*
** AI Data Analyst ('/data-analysis') **
- **Purpose:** Simulates a data analyst to provide insights from user-described data files.
- **Logic:** This feature works based on **simulation**. The user "uploads" files (only metadata is sent) and provides a very detailed `userAnalysisPrompt`. The AI simulates data cleaning, KPI calculation, and insight generation based *only* on the user's textual description. The output includes a critical disclaimer that the analysis is based on this description.
*/

// --- Prompt: AI Data Analyst --- //
/*
You are an advanced Excel analyst AI, specializing in telesales and subscription operations. Your job is to intelligently clean, reformat, and analyze business data (as described by the user) for actionable insights.

CRITICAL: User's Detailed Data Description & Analysis Prompt:
This is your PRIMARY and ESSENTIAL source of information about the data structure, contents (including any messiness), and analytical goals.
"""
{{{userAnalysisPrompt}}}
"""

Your Analytical Process (Simulated based on User's Description):
1.  **Data Reconstruction (Simulated):** Explain how you would hypothetically clean the data based on the user's description.
2.  **Table Normalization (Simulated):** Describe how you would reconstruct the data into clean tables.
3.  **Smart Table Recognition:** Explain how you are inferring the purpose of different data tables (e.g., CDR, Daily MIS).
4.  **KPI Calculation:** From the *assumed* clean tables, calculate or explain how you would calculate key KPIs.
5.  **Insight Generation:** Populate the report with insights from your simulated analysis.
6.  **Output Style:** Adhere strictly to the 'DataAnalysisReportSchema' and always include the standard disclaimer.
*/

/*
** Batch Audio Downloader ('/batch-audio-downloader') **
- **Purpose:** Downloads multiple audio files from URLs and bundles them into a ZIP archive.
- **Logic:** A purely **client-side** utility using `jszip` and `xlsx`. The user provides URLs via text or an Excel file. The frontend `fetch`es each file and adds it to a `JSZip` instance, which then generates a downloadable ZIP file. It includes a clear warning about server CORS policies.
*/


// ==================================================
//                 SYSTEM & DASHBOARDS
// ==================================================

/*
** All Dashboards (e.g., '/call-scoring-dashboard', '/transcription-dashboard') **
- **Purpose:** To view historical activity for a specific module.
- **Implementation:** All dashboards are client components that use the \`useActivityLogger\` hook to read data from \`localStorage\`.
- **Logic:** They filter activities by module, render them in a table, and provide a "View Details" dialog that often reuses the primary feature's results card. They all include data export functionality.

** Global Activity Log ('/activity-dashboard') **
- **Purpose:** A master log of every significant user action.
- **Logic:** Reads the full activity log from \`useActivityLogger\` and provides advanced filtering by date, agent, module, and product.

** Clone Full App ('/clone-app') **
- **Purpose:** Provides the full source code and replication prompts.
- **Logic:** A "Download Project ZIP" button calls the \`/api/clone-app\` API route, which uses \`JSZip\` on the server to package the project files. A "Copy Replication Prompt" button copies this entire document to the clipboard.
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
    exportPlainTextFile("AI_TeleSuite_Full_Replication_Prompt.txt", ALL_PROMPTS_TEXT);
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
                    <Download className="mr-2 h-4 w-4" /> Download Full Replication Prompt
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
