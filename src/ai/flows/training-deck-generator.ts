
'use server';
/**
 * @fileOverview Generates a training deck or brochure content based on product and knowledge base items, direct file uploads, or a direct user prompt.
 * - generateTrainingDeck - A function that handles training deck/brochure generation.
 * - GenerateTrainingDeckInput - The input type for the flow.
 * - GenerateTrainingDeckOutput - The return type for the flow.
 * - TrainingDeckFlowKnowledgeBaseItem - The type for knowledge base items within the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Product, PRODUCTS } from '@/types';

// Internal Zod schema, not exported
const KnowledgeBaseItemSchemaInternal = z.object({
  name: z.string().describe("Name of the knowledge base item (e.g., file name, text entry title, or 'User-Provided Prompt')."),
  textContent: z.string().optional().describe("Full text content if the item is a text entry from KB, a small directly uploaded text file, or the direct user prompt."),
  isTextEntry: z.boolean().describe("Whether this item is a direct text entry from the KB or a direct user prompt."),
  fileType: z.string().optional().describe("MIME type of the file, if applicable (especially for direct uploads). Will be 'text/plain' for prompts.")
});
export type TrainingDeckFlowKnowledgeBaseItem = z.infer<typeof KnowledgeBaseItemSchemaInternal>; 

const GenerateTrainingDeckInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the training material is for.'),
  deckFormatHint: z.enum(["PDF", "Word Doc", "PPT", "Brochure"]).describe('The intended output format (influences content structure suggestion).'),
  knowledgeBaseItems: z.array(KnowledgeBaseItemSchemaInternal).describe('An array of contextual items: selected KB items, items derived from direct file uploads, OR a single item representing a direct user prompt. For KB files or larger/binary direct uploads, only name/type is primary context unless textContent is provided. For text entries from KB or direct prompts, full textContent is available.'),
  generateFromAllKb: z.boolean().describe('If true, knowledgeBaseItems represents the entire KB relevant to the product (and direct uploads/prompts are ignored).'),
  sourceDescriptionForAi: z.string().optional().describe("A brief description of the source of the knowledgeBaseItems (e.g., 'selected KB items', 'entire KB for ET', 'directly uploaded files: report.docx, notes.txt', 'a direct user-provided prompt'). This helps the AI understand the context source.")
});
export type GenerateTrainingDeckInput = z.infer<typeof GenerateTrainingDeckInputSchema>;

const ContentSectionSchema = z.object({
  title: z.string().describe("The title of this section/slide/panel."),
  content: z.string().describe("The main content for this section, formatted with bullet points, paragraphs, or concise statements as appropriate for the target format. Keep content focused for each section. For brochures, content should be persuasive and benefit-oriented, including textual suggestions for visuals e.g., (Visual: Happy customer using product)."),
  notes: z.string().optional().describe("Optional speaker notes for slides, or internal notes/suggestions for brochure panels (e.g., 'Use vibrant background', 'Feature customer testimonial', 'Visual Suggestion Detail: ...').")
});

const GenerateTrainingDeckOutputSchema = z.object({
  deckTitle: z.string().describe("The overall title for the training material (deck or brochure)."),
  sections: z.array(ContentSectionSchema).min(3).describe("An array of at least 3 sections/slides/panels. For decks: intro, content, conclusion. For brochures: cover panel, internal panels, call-to-action panel."),
});
export type GenerateTrainingDeckOutput = z.infer<typeof GenerateTrainingDeckOutputSchema>;

const generateTrainingMaterialPrompt = ai.definePrompt({
  name: 'generateTrainingMaterialPrompt',
  input: {schema: GenerateTrainingDeckInputSchema}, 
  output: {schema: GenerateTrainingDeckOutputSchema},
  prompt: `You are a presentation and documentation specialist trained to create professional training material, particularly for telesales businesses like {{{product}}} (ET Prime or TOI Plus).

Product: {{{product}}} (Use this to tailor references like "ET Prime" or "TOI Plus")
Target Output Format: {{{deckFormatHint}}}
Source of Information Context: {{{sourceDescriptionForAi}}}

Contextual Information Provided (KnowledgeBase Items/Direct Prompt):
{{#if knowledgeBaseItems.length}}
{{#each knowledgeBaseItems}}
- Item Name: {{name}} (Type: {{#if isTextEntry}}Text Entry/Direct Prompt{{else}}{{fileType}}{{/if}})
  {{#if textContent}}Content (excerpt if long): {{{textContent}}}{{else}}(File content not directly viewable, rely on name, type, and overall user prompt for context){{/if}}
{{/each}}
{{else}}
(No specific contextual items provided. If so, generate a generic welcome/overview for {{{product}}} or a placeholder training structure.)
{{/if}}
{{#if generateFromAllKb}}
(The user has indicated to use the entire knowledge base for product '{{{product}}}', represented by the items above if populated, otherwise assume general knowledge about {{{product}}} for a basic structure.)
{{/if}}

Your Task:
Generate content for a training material (deck or brochure).
1.  Create a compelling 'deckTitle'.
2.  Structure the content into logical 'sections' (at least 3). Each section needs a 'title', 'content', and optional 'notes'.

**Special Case: "Telesales Data Analysis Framework"**
If the provided Contextual Information (especially from a direct user prompt with a name like "User-Provided Prompt", or the nature of multiple knowledge base items) CLEARLY indicates the goal is to create a "Telesales Data Analysis Framework" deck explaining how to conduct full-funnel data analysis using MIS, call records, leads, and revenue data, then you MUST structure your output according to the following 9-section framework:

    --- BEGIN FRAMEWORK ---
    1.  Title Slide
        -   Title: "Telesales Data Analysis Framework"
        -   Subtitle: "{{product}} (insert 'Prime' or 'Plus' as appropriate) | Agent Performance & Revenue Intelligence"
    2.  Objective
        -   Explain the purpose: to drive actionable insights from agent data, call logs, and campaign performance across lead cohorts
    3.  Data Sources Overview
        -   List and briefly explain each data input: ET MIS, CDR Dump, Source Dump, Monthly Revenue Report, April Training Impact Report
    4.  Key Metrics Tracked
        -   Conversion Rate, Revenue per Call, Follow-Up Rate, Connection Rate, Average Talktime, Agent Performance Index (composite)
    5.  Analytical Steps
        -   Step-by-step method to clean, process, and analyze each dataset. How to join data using Agent ID, Phone, Lead ID. How to segment by cohort (e.g. Payment Drop-off vs Paywall).
    6.  Sample Analysis Output
        -   Describe (do not generate actual charts/tables, but describe what they would show): Monthly trend graph, Agent leaderboard table, Cohort conversion summary, Follow-up gap analysis.
    7.  Recommendations Framework
        -   How to translate insights into business actions: Redistribute leads, Train specific agents, Optimize follow-up timing, Adjust incentive slabs.
    8.  Checklist for Analysts
        -   Data validation, Mapping fields, Cohort tagging, Cross-sheet joining logic, Final insight synthesis.
    9.  Closing Slide
        -   Summary: "Data-backed decisions = Scaled revenue"
        -   Call to Action: "Run this every month to stay ahead"
    --- END FRAMEWORK ---
    When using this framework, ensure the content for each section is comprehensive and aligns with the style guidance below. If the Contextual Information provides specific details relevant to any of these sections (e.g., specific cohorts for ET MIS, or particular metrics for an "April Training Impact Report"), incorporate them.

**General Case (If not the specific Data Analysis Framework deck):**
Synthesize the provided 'Contextual Information' (KnowledgeBase Items/Direct Prompt) into a relevant and well-structured training material. The sections should logically flow from the input. If multiple KB items are provided, try to weave them into a cohesive narrative or structure. If only a single text prompt is given, expand on that prompt to create the material.

**Content Style Guidance based on '{{{deckFormatHint}}}':**
- If 'deckFormatHint' is 'PDF' or 'Brochure':
    - The 'content' for each section should be more narrative and paragraph-based. For 'Brochure', make it persuasive and benefit-oriented. Include TEXTUAL suggestions for visuals (e.g., "(Visual: Chart showing growth of Conversion Rate month-over-month)").
    - 'Notes' for 'Brochure' can be layout/visual suggestions. For 'PDF', they can be supplementary details.
- If 'deckFormatHint' is 'Word Doc' or 'PPT':
    - The 'content' for each section should be concise, primarily using bullet points or short, impactful statements.
    - 'Notes' can be speaker notes for PPT, or detailed explanations for a Word outline.

Focus on clarity, professionalism, and business relevance to {{{product}}}. Ensure the output is detailed and comprehensive.
If the contextual information is very sparse or too generic to create meaningful content for the chosen product and format, explicitly state that in the output, perhaps in the first section, and provide a placeholder structure or general advice.
`,
  model: 'googleai/gemini-2.0-flash'
});

const generateTrainingDeckFlow = ai.defineFlow(
  {
    name: 'generateTrainingDeckFlow',
    inputSchema: GenerateTrainingDeckInputSchema, 
    outputSchema: GenerateTrainingDeckOutputSchema,
  },
  async (input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> => {
    try {
      const {output} = await generateTrainingMaterialPrompt(input);
      if (!output) {
        throw new Error("AI failed to generate training material content.");
      }
      // Basic validation to ensure AI followed the schema structure
      if (!output.deckTitle || !Array.isArray(output.sections) || output.sections.length < 1) {
        console.error("AI output missing required fields (deckTitle or sections array). Input was:", JSON.stringify(input, null, 2));
        const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
        return {
            deckTitle: `Error Generating ${materialType} - Invalid AI Response Structure`,
            sections: [
            { title: "Structural Error", content: `The AI's response did not match the expected structure. It may have failed to generate a title or section details. Please try again or simplify the input context.`, notes: "AI response structure was malformed." },
            { title: "Input Context Sent", content: `Product: ${input.product}, Format: ${input.deckFormatHint}, Source: ${input.sourceDescriptionForAi || 'N/A'}` },
            ]
        };
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generateTrainingDeckFlow:", error);
      const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
      return {
        deckTitle: `Error Generating ${materialType} - AI Failed`,
        sections: [
          { title: "Error", content: `AI service failed: ${error.message}. Ensure Google API Key is set and valid.`, notes: "Check API key and try again." },
          { title: "Instructions", content: "The AI could not generate the content. Please review your input and ensure all selected knowledge base items (if any) are appropriate." },
          { title: "Support", content: "If the issue persists, contact support." }
        ]
      };
    }
  }
);

export async function generateTrainingDeck(input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> {
   try {
    // Ensure at least one KB item is present if not generating from all KB and no direct prompt text.
    // This is a pre-check before calling the flow.
    if (!input.generateFromAllKb && (!input.knowledgeBaseItems || input.knowledgeBaseItems.length === 0)) {
      const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
       console.warn("generateTrainingDeck called with no KB items and not generateFromAllKb. Input:", JSON.stringify(input, null, 2));
       return {
        deckTitle: `Input Error - No Context for ${materialType}`,
        sections: [
          { title: "Missing Context", content: "No knowledge base items or direct prompt was provided to generate the training material. Please select items from the Knowledge Base, upload files, or provide a direct prompt on the 'Create Training Material' page.", notes: "User did not provide sufficient context." },
        ]
      };
    }
    
    // Truncate long textContent in knowledgeBaseItems before sending to AI to avoid overly large prompts
    const processedInput = {
      ...input,
      knowledgeBaseItems: (input.knowledgeBaseItems || []).map(item => ({
        ...item,
        textContent: item.textContent && item.textContent.length > 2000 
          ? item.textContent.substring(0, 2000) + "\n...(textContent truncated due to length)" 
          : item.textContent
      }))
    };

    return await generateTrainingDeckFlow(processedInput);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generateTrainingDeckFlow:", error);
    const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
    return {
        deckTitle: `Critical Error Generating ${materialType}`,
        sections: [
          { title: "System Error", content: `A critical server-side error occurred: ${error.message}. Check server logs.`, notes: "This indicates a system-level problem." },
          { title: "Failure", content: "The training material generation service encountered a critical failure." },
          { title: "Next Steps", content: "Please try again later or contact support if the issue persists." }
        ]
    };
  }
}
