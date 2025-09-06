
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { Button } from "@/components/ui/button";
import { Sheet, Trash2, Download } from "lucide-react";
import { exportPlainTextFile } from "@/lib/export";
import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useActivityLogger } from "@/hooks/use-activity-logger";

const ALL_PROMPTS_TEXT = `
// --- AI_TeleSuite: Full AI Prompts & Implementation Logic --- //

// Note: This document contains the core prompts used by the AI for various features,
// along with explanations of the logic and data schemas. The actual prompts sent to the AI
// may include additional dynamic data (e.g., user inputs, specific Knowledge Base content).
// Handlebars syntax (e.g., {{{variable}}}, {{#if condition}}...{{/if}}) is used for templating.

// ==================================================
// 1. Pitch Generator (src/ai/flows/pitch-generator.ts)
// ==================================================

/*
** High-Level Logic **
1.  The user selects a product, customer cohort, and optionally provides a direct context file.
2.  The frontend prepares a \`knowledgeBaseContext\` string. If a direct file is uploaded, its content (if text-readable) or metadata is prioritized and prepended to the general KB content for that product.
3.  The \`generatePitch\` flow is called with this combined context.
4.  The AI is instructed to act as a world-class sales agent and to **exclusively use the provided Knowledge Base context**. It's given strict rules on which KB category to use for which part of the pitch (e.g., 'Pitch' documents for flow, 'Product Description' for facts).
5.  If the KB is insufficient, the AI is authorized to browse the product's official website as a fallback.
6.  The AI must populate all fields of the \`GeneratePitchOutputSchema\` distinctly, ensuring a structured and comprehensive pitch.

** Zod Output Schema: GeneratePitchOutputSchema **
(Defines the structured output the AI must generate)
- pitchTitle: string
- warmIntroduction: string
- personalizedHook: string
- productExplanation: string
- keyBenefitsAndBundles: string
- discountOrDealExplanation: string
- objectionHandlingPreviews: string
- finalCallToAction: string
- fullPitchScript: string (A complete dialogue integrating all components)
- estimatedDuration: string
- notesForAgent: string (optional notes for the agent)

** Core AI Prompt **
*/
You are a world-class sales agent. Your goal is to be empathetic, persuasive, and clear, using the provided KB to drive conversion. Your responses must be of the absolute highest quality.

**CRITICAL DIRECTIVE: You MUST base your entire response *exclusively* on the information provided in the structured 'Knowledge Base Context' section below. If a 'USER-SELECTED KB CONTEXT' section is present, it is your PRIMARY source of truth and MUST be prioritized over the general KB.**
**If the provided Knowledge Base is insufficient or lacks specific details, you are authorized to supplement your response by browsing the official product website ({{{brandUrl}}}) and its sub-pages to gather the necessary information. Your primary goal is to be truthful and persuasive.**

**KNOWLEDGE BASE USAGE RULES (NON-NEGOTIABLE):**
1.  For the overall call structure, introduction, and flow, you MUST primarily use the content from any Knowledge Base item categorized as **'Pitch'**.
2.  For factual content about the product, including features, benefits, and value propositions, you MUST exclusively use content from items categorized as **'Product Description'**.
3.  For pricing details, offers, and discounts, you MUST use content from items categorized as **'Pricing'**.
4.  If a category of document is missing, you must state that in the 'notesForAgent' and generate a generic but safe response for that section.
5.  Never invent information. If the KB doesn't provide a detail, do not mention it.

// ... (rest of the detailed prompt is included, specifying output rules and structure)


// ==================================================
// 2. Rebuttal Generator (src/ai/flows/rebuttal-generator.ts)
// ==================================================

/*
** High-Level Logic **
1.  The user enters a customer objection for a specific product.
2.  The frontend prepares the \`knowledgeBaseContext\` for that product.
3.  The \`generateRebuttal\` flow is called.
4.  The AI is instructed to act as a sales coach and ground its response **exclusively** in the provided KB context.
5.  The prompt includes a "Chain of Thought" section, forcing the AI to internally analyze the objection, extract relevant KB facts, and formulate a strategy before generating the final text.
6.  The final rebuttal MUST follow the "Acknowledge, Bridge, Benefit, Clarify/Question" (ABBC/Q) structure.
7.  A non-AI fallback function \`generateFallbackRebuttal\` exists. It uses keyword analysis and simple templates to generate a decent rebuttal if the AI service fails or if the KB is empty, ensuring high availability.

** Zod Output Schema: GenerateRebuttalOutputSchema **
- rebuttal: string (The final, structured rebuttal text)

** Core AI Prompt **
*/
You are a world-class sales coach and linguist, specializing in crafting perfect rebuttals for telesales agents selling {{{product}}} subscriptions. Your responses must be of the absolute highest quality: crystal-clear, empathetic, strategic, and self-explanatory based on the context.

**Customer's Objection:** "{{{objection}}}"

**CRITICAL: Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context' section below...**

**Your Task & Reasoning Process (Chain of Thought - Internal Monologue):**
1.  **Analyze & Categorize Objection:** What is the ROOT of the user's objection?
2.  **Extract Relevant KB Facts:** Scan the Knowledge Base and extract the 1-3 MOST relevant facts.
3.  **Formulate Strategy:** How will you use these facts to reframe the objection?

**Final Rebuttal Generation (Adhere to this Quality Rubric):**
1.  **Adaptive Length (CRITICAL):** ...
2.  **Mandatory Structure (ABBC/Q - Acknowledge, Bridge, Benefit, Clarify/Question):** ...

// ... (rest of the detailed prompt is included, specifying tone and language rules)


// ==================================================
// 3. AI Call Scoring (src/ai/flows/call-scoring.ts)
// ==================================================

/*
** High-Level Logic **
1.  The flow receives a call transcript and product context.
2.  It uses a two-tiered system for resilience. **Tier 1** uses a powerful model (\`gemini-1.5-flash-latest\`) with a highly detailed, rubric-based prompt for an exhaustive analysis. This prompt includes over 30 specific metrics to score.
3.  If the Tier 1 model fails (e.g., due to API rate limits), the flow retries with exponential backoff.
4.  If all retries fail, **Tier 2** (the backup engine) is triggered. It uses a more available model (\`gemini-2.0-flash\`) with a simpler prompt to generate a structured, high-level summary. This ensures a useful report is always returned.
5.  The final output, whether from Tier 1 or Tier 2, is returned in the same \`ScoreCallOutputSchema\` format, providing consistency to the frontend.

** Zod Output Schema: ScoreCallOutputSchema **
(A comprehensive schema with fields for overall score, categorization, summary, strengths, improvements, red flags, and two detailed arrays)
- metricScores: array (An object for EACH metric from the rubric with 'metric', 'score', and 'feedback')
- improvementSituations: array (Objects detailing a specific moment in the call with context, agent response, and a better suggested response)

** Core AI Prompt (for Tier 1 Deep Analysis) **
*/
You are an EXHAUSTIVE and DEEPLY ANALYTICAL telesales call quality analyst. Your task is to perform a top-quality, detailed analysis of a sales call based on the provided transcript, a strict multi-faceted rubric, and the detailed product context...

**EVALUATION RUBRIC (Metrics to score):**
*   **Intro Hook Line:** ...
*   **Opening Greeting (satisfactory/unsatisfactory):** ...
*   **Misleading Information by Agent:** ...
*   **Pitch Adherence:** ...
// ... (over 30 metrics are listed here in the actual prompt) ...
*   **Not Satisfied with ET Prime Feature:** ...

**FINAL OUTPUT SECTIONS (Top-level fields):**
- **overallScore:** ...
- **callCategorisation:** ...
// ... (all other top-level fields are defined)
- **improvementSituations**: Identify 2-4 specific moments in the call where the agent's response could have been significantly better...

// ... (rest of the detailed prompt is included)

// --- End of AI_TeleSuite Prompts --- //
`;

export default function KnowledgeBaseManagementPage() {
  const { files, addFile, addFilesBatch, deleteFile, setFiles } = useKnowledgeBase();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);


  const handleAddSingleEntry = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    addFile(fileData); 
  };

  const handleAddMultipleFiles = (filesData: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>) => {
    addFilesBatch(filesData); 
  };
  
  const handleDeleteFile = (fileId: string) => {
    const fileName = files.find(f => f.id === fileId)?.name || "Unknown file";
    deleteFile(fileId);
    toast({
      title: "Entry Deleted",
      description: `"${fileName}" has been removed from the knowledge base.`,
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
        details: {
            action: "clear_all",
            countCleared: count,
        }
    });
    setIsClearAlertOpen(false);
  };
  
  const handleDownloadFullPrompts = () => {
    exportPlainTextFile("AI_TeleSuite_Full_Prompts_Logic.txt", ALL_PROMPTS_TEXT);
    toast({ title: "Full AI Prompts Downloaded", description: "AI_TeleSuite_Full_Prompts_Logic.txt has been downloaded." });
    logActivity({ module: "Knowledge Base Management", details: { action: "download_full_prompts" }});
  };

  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm 
          onSingleEntrySubmit={handleAddSingleEntry} 
          onMultipleFilesSubmit={handleAddMultipleFiles} 
        />
        <div className="w-full max-w-4xl flex justify-end space-x-2">
           <Button onClick={handleDownloadFullPrompts} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Download AI Prompts & Logic
          </Button>
          <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={files.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear All Entries
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all 
                  ({files.length}) entries from your knowledge base.
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
        <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
      </main>
    </div>
  );
}

    