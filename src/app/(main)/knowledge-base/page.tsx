
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sheet, Trash2, Download, Lightbulb, MessageSquareReply } from "lucide-react"; 
import { exportToCsv, exportPlainTextFile } from "@/lib/export";
import { format, parseISO } from 'date-fns';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useActivityLogger } from "@/hooks/use-activity-logger";

const PITCH_GENERATOR_PROMPT_TEXT = `You are a GenAI-powered telesales assistant trained to generate high-conversion sales pitches for two premium Indian media subscriptions: {{product}}.
Your task is to generate a professional, persuasive, 3–5 minute telesales pitch (approximately 450-600 words) that an agent can read aloud to a prospective subscriber.
Adhere strictly to the following structure and guidelines, populating all fields in the 'GeneratePitchOutputSchema'. Ensure each section (Warm Introduction through Final Call to Action) is sufficiently detailed and contributes effectively to the overall target length of the 'fullPitchScript'. The quality and completeness of each individual section are paramount.

User and Pitch Context:
- Product to Pitch: {{{product}}}
- Customer Cohort: {{{customerCohort}}}
- Sales Plan (if specified): {{{salesPlan}}}
- Specific Offer (if specified): {{{offer}}}
- Agent's Name (if specified): {{{agentName}}}
- Customer's Name (if specified): {{{userName}}}
{{#if etPlanConfiguration}}
- ET Plan Configuration to consider: {{{etPlanConfiguration}}}
{{/if}}

CRITICAL INSTRUCTION: The 'Knowledge Base Context' provided below is your *ONLY* source of truth for product features, benefits, and specific details about {{{product}}}. You MUST NOT invent, assume, or infer any features, benefits, pricing, or details that are not EXPLICITLY stated in the 'Knowledge Base Context'. If the context is limited for a certain aspect, your pitch must also be limited for that aspect. Prioritize explaining customer *benefits* derived from features rather than just listing features.

Knowledge Base Context (Your Sole Source for Product Details):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Pitch Structure and Content Guidelines:
1.  **pitchTitle**: Create a compelling title for this specific pitch.
2.  **warmIntroduction**: Start with a friendly greeting. Introduce the agent (using "{{AGENT_NAME}}" if provided, otherwise "your agent") and the brand ("{{PRODUCT_NAME}}").
3.  **personalizedHook**: Mention the purpose of the call clearly. Personalize this hook based on the "{{customerCohort}}":
    *   If 'Payment Drop-off': Emphasize offer urgency and ease of completion.
    *   If 'Plan Page Drop-off': Clarify plan details (using "{{PLAN_NAME}}" for {{{salesPlan}}} and "{{OFFER_DETAILS}}" for {{{offer}}} if available) and highlight specific benefits from the Knowledge Base.
    *   If 'Paywall Drop-off': Focus on the content quality and long-term value from the Knowledge Base.
    *   If 'Assisted Buying': Be direct, goal-oriented, and mention agent assistance.
    *   If 'Renewal Drop-off' or 'Expired Users': Reinforce continued value, highlight upgrades or special deals for returning users from the Knowledge Base.
    *   For other cohorts, adapt the hook logically based on the cohort's meaning and information from the Knowledge Base.
4.  **productExplanation**: Concisely explain what {{{product}}} is. Use brand-specific benefit language derived *only* from the Knowledge Base Context:
    *   For ET Prime: Mention (if in KB) deep market analysis, expert investment research, ad-free reading, exclusive reports, trusted by India’s top business readers.
    *   For TOI Plus: Mention (if in KB) premium editorial journalism, ad-free access, early content access, in-depth coverage, trusted voice of India.
    *   CRITICALLY, focus on translating features found *ONLY* in the Knowledge Base Context into clear, compelling *customer advantages and benefits* relevant to the "{{customerCohort}}".
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits* of {{{product}}}. These MUST be derived from the Knowledge Base Context. Explain what the customer *gains* from these features. If bundles (e.g., TimesPrime, Docubay) are mentioned in the KB, explain their *added value and specific benefits* to the customer.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal confidently but mention it no more than twice. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the value of this specific offer. If no plan/offer is specified, briefly mention that attractive plans are available.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, trust, hesitation) with brief, benefit-oriented rebuttals. These rebuttals must be based on information *found only* in the Knowledge Base Context (e.g., using 'Common Selling Themes' like Value for Money, Productivity Boost if present in KB).
8.  **finalCallToAction**: Conclude with a strong call to action, such as: "Would you like me to help you complete the subscription now?" or "Shall I send you a link to activate the offer before it expires?"
9.  **fullPitchScript**: This is the main output. Ensure this script comprehensively and smoothly integrates *all* the detailed content generated for the individual sections above. Combine all sections into a single, flowing script of 450-600 words. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}} (for {{{product}}}), {{USER_COHORT}} (for {{{customerCohort}}}), {{PLAN_NAME}} (for {{{salesPlan}}}), {{OFFER_DETAILS}} (for {{{offer}}}), and <INSERT_PRICE> where appropriate. The script should sound natural, be broken into manageable paragraphs, and be easy for a telesales agent to deliver.
10. **estimatedDuration**: Estimate the speaking time for the 'fullPitchScript' (e.g., "3-5 minutes").
11. **notesForAgent** (Optional): Provide 1-2 brief, actionable notes for the agent delivering this specific pitch, based on the product and cohort (e.g., "For 'Paywall Dropoff' cohort, strongly emphasize the exclusive content benefit.").

Tone Guidelines:
- Conversational, confident, respectful of the user’s time.
- Avoid robotic repetition or sales clichés.
- Be helpful, not pushy.
- Use simple English. Subtle Hinglish elements are acceptable if they sound natural for a telesales context in India, but prioritize clarity.

Generate the pitch.`;

const REBUTTAL_GENERATOR_PROMPT_TEXT = `You are a GenAI-powered telesales assistant trained to provide quick, convincing rebuttals for objections related to {{{product}}} subscriptions.
Your task is to provide a professional, specific, and effective response to the customer's objection, leveraging the provided Knowledge Base.

Customer's Objection: "{{{objection}}}"

Product: {{{product}}}

Knowledge Base Context for '{{{product}}}' (Your ONLY source for rebuttal points):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Instructions for Rebuttal Generation:
1.  **Understand the Core Objection:** First, deeply analyze the customer's statement "{{{objection}}}" to understand the underlying concern or reason for their hesitation. Is it about price, value, trust, timing, a past experience, or a misunderstanding of the product?

2.  **Strategic KB Search & Synthesis:** Thoroughly search the 'Knowledge Base Context'. Look for 1-2 highly relevant facts, features, user benefits, testimonials, or 'Common Selling Themes' (like Value for Money, Productivity Boost, Exclusivity) that directly address or reframe the *specific underlying concern* you identified in step 1. Do NOT pick generic points. Your goal is to *synthesize* this information into a compelling argument, not just list facts.

3.  **Craft the Rebuttal - Acknowledge, Bridge, Benefit, Question (ABBC/Q):**
    *   **Acknowledge:** Start with an empathetic acknowledgment of the customer’s concern (e.g., "I understand your concern about that...", "That's a fair point to consider...", "I can see why you might feel that way...").
    *   **Bridge & Benefit:** Smoothly transition to the most relevant point(s) you've synthesized from the Knowledge Base. Clearly explain the *benefit* or *value* this KB point offers in relation to their objection. This is not just about finding a KB point, but about *transforming* it into a persuasive argument. Show how the KB fact directly addresses or mitigates the customer's specific concern.
        *   *Example of Transforming KB info:* If the objection is "It's too expensive," and the KB mentions "Exclusive market reports save users hours of research," your rebuttal could be: "I understand budget is a key factor. Many of our subscribers find that the exclusive market reports included with {{{product}}} save them significant research time, which itself has a monetary value. For instance, if you save even a few hours a month, that value can quickly offset the subscription cost. Does that perspective on time-saving help address your concern about the price?"
    *   **Detail Level & Length:** The length of your rebuttal should be proportionate to the complexity of the objection and the richness of relevant information in the KB. If a short, impactful answer is sufficient, use that. However, if the objection is nuanced and the KB offers substantial counter-points, provide a more *detailed and comprehensive rebuttal* to fully address the customer's concern and build a strong case. Aim for a natural conversational flow that feels helpful, not overwhelming or robotic.
    *   **Question (Optional but Recommended):** If appropriate, end with a gentle, open-ended question to encourage dialogue or clarify their concern further (e.g., "Does that perspective on value help address your concern about the price?", "Could you tell me a bit more about what makes you feel it's not the right time?", "What are your thoughts on this aspect?", "How does that sound as a way to look at it?").

4.  **Impact and Clarity:** Ensure the rebuttal is impactful and easy to understand, regardless of length. Focus on addressing the customer's concern directly and persuasively using synthesized KB facts. Avoid generic statements. The more specific your rebuttal is to the objection *and* the product's KB information, the better.

5.  **Tone:** Maintain a confident, helpful, professional, and understanding tone. Avoid being defensive, dismissive, or argumentative. Your goal is to sound like a knowledgeable expert who is using the KB as their source, not like an AI listing facts.

6.  **Strict KB Adherence:**
    *   Your rebuttal MUST be based *exclusively* on information found in the provided 'Knowledge Base Context'.
    *   If the Knowledge Base genuinely lacks a direct counter for the *specific* objection, acknowledge the objection honestly. Then, try to pivot to a general strength or key benefit of '{{{product}}}' (from the KB) that might still be relevant, and follow up with a clarifying question. Example: "I understand your point about [objection]. While our current information doesn't specifically detail [that exact scenario], I can share that {{{product}}} is highly valued for [key benefit from KB, e.g., 'its comprehensive coverage of X sector']. Perhaps if you could tell me more about [aspect of objection], I could provide more relevant information?"
    *   Do NOT invent information or make assumptions beyond the KB.

Common Objections (for context, your response should address the *actual* "{{{objection}}}"):
- "It’s too expensive"
- "I’ll think about it" / "Send me details on WhatsApp"
- "I don’t have time right now" / "Maybe later"
- "Didn’t find it useful earlier" / "I get news for free anyway"

Provide only the rebuttal text in the 'rebuttal' field. Ensure it is a well-structured and complete response.`;

export default function KnowledgeBasePage() {
  const { files, addFile, addFilesBatch, deleteFile, setFiles } = useKnowledgeBase();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  const handleExportCsv = () => {
    if (files.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no data in the knowledge base to export.",
      });
      return;
    }
    try {
      const filesForExport = files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.isTextEntry ? `${file.size} chars` : file.size,
        product: file.product || 'N/A',
        persona: file.persona || 'N/A',
        isTextEntry: file.isTextEntry ? 'Yes' : 'No',
        uploadDate: format(parseISO(file.uploadDate), 'yyyy-MM-dd HH:mm:ss'),
        textContentPreview: file.isTextEntry && file.textContent ? file.textContent.substring(0, 50) + "..." : "N/A"
      }));
      exportToCsv('knowledge_base_log.csv', filesForExport);
      toast({
        title: "Export Successful",
        description: "Knowledge base log exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export knowledge base data to CSV.",
      });
      console.error("Knowledge Base CSV Export error:", error);
    }
  };

  const handleClearAllKnowledgeBase = () => {
    const count = files.length;
    setFiles([]); // This clears all files, including system defaults if any were client-side generated only
    toast({
      title: "Knowledge Base Cleared",
      description: `${count} entr(y/ies) have been removed. System default entries will be re-added on next load if applicable.`,
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

  const handleDownloadPitchPrompt = () => {
    exportPlainTextFile("pitch_generator_prompt.txt", PITCH_GENERATOR_PROMPT_TEXT);
    toast({ title: "Pitch Prompt Downloaded", description: "pitch_generator_prompt.txt has been downloaded." });
    logActivity({ module: "Knowledge Base Management", details: { action: "download_prompt", prompt_name: "Pitch Generator" }});
  };
  
  const handleDownloadRebuttalPrompt = () => {
    exportPlainTextFile("rebuttal_generator_prompt.txt", REBUTTAL_GENERATOR_PROMPT_TEXT);
    toast({ title: "Rebuttal Prompt Downloaded", description: "rebuttal_generator_prompt.txt has been downloaded." });
     logActivity({ module: "Knowledge Base Management", details: { action: "download_prompt", prompt_name: "Rebuttal Generator" }});
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm 
          onSingleEntrySubmit={handleAddSingleEntry} 
          onMultipleFilesSubmit={handleAddMultipleFiles} 
        />

        <Card className="w-full max-w-4xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Download className="mr-2 h-5 w-5 text-primary" /> 
              Download AI Prompts
            </CardTitle>
            <CardDescription>
              Download the core text prompts used by the AI for key generation features. These are provided for reference and understanding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
              <Button onClick={handleDownloadPitchPrompt} variant="outline" className="w-full sm:w-auto">
                <Lightbulb className="mr-2 h-4 w-4" /> Download Pitch Prompt
              </Button>
              <Button onClick={handleDownloadRebuttalPrompt} variant="outline" className="w-full sm:w-auto">
                <MessageSquareReply className="mr-2 h-4 w-4" /> Download Rebuttal Prompt
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: These are the base prompts. Modifying these downloaded files will not affect the application's AI behavior. The actual prompts sent to the AI include dynamic data based on your inputs and selected Knowledge Base content.
            </p>
          </CardContent>
        </Card>
        
        <div className="w-full max-w-4xl flex justify-end space-x-2">
          <Button onClick={handleExportCsv} variant="outline" disabled={files.length === 0 || !isClient}>
            <Sheet className="mr-2 h-4 w-4" /> Export KB Log as CSV
          </Button>
          <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={files.length === 0 || !isClient}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear All KB Entries
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
        
        {isClient ? (
          <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
        ) : (
          <div className="w-full max-w-4xl space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </main>
    </div>
  );
}

