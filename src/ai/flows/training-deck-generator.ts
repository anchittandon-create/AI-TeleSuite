
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

// Internal schema for the prompt, including the derived boolean flag
const GenerateTrainingMaterialPromptInputSchema = GenerateTrainingDeckInputSchema.extend({
  isBrochureFormat: z.boolean().describe("True if the deckFormatHint is 'Brochure', false otherwise.")
});
type GenerateTrainingMaterialPromptInput = z.infer<typeof GenerateTrainingMaterialPromptInputSchema>;

const generateTrainingMaterialPrompt = ai.definePrompt({
  name: 'generateTrainingMaterialPrompt',
  input: {schema: GenerateTrainingMaterialPromptInputSchema},
  output: {schema: GenerateTrainingDeckOutputSchema},
  prompt: `You are a training material creation expert for sales teams.
Product: {{{product}}}
Target Output Format: {{{deckFormatHint}}} (This informs the structure, e.g., slides for PPT/PDF/Word, panels for Brochure)
Is this for a Brochure? {{{isBrochureFormat}}}
Source of Information: {{{sourceDescriptionForAi}}}

Contextual Information Provided (use this as primary input):
{{#if knowledgeBaseItems.length}}
{{#each knowledgeBaseItems}}
- Item Name: {{name}} (Type: {{#if isTextEntry}}Text Entry{{else}}{{fileType}}{{/if}})
  {{#if textContent}}Content: {{{textContent}}}{{else}}(File content not directly viewable, rely on name, type, and overall user prompt for context){{/if}}
{{/each}}
{{else}}
No specific knowledge base items provided, rely on general product knowledge and the user's overall request.
{{/if}}
{{#if generateFromAllKb}}
The user has indicated to use the entire knowledge base for product '{{{product}}}' (represented by the items above if populated, otherwise assume general knowledge about {{{product}}}).
{{/if}}

Task: Generate content for the training material.
- Create a compelling Deck Title.
- Structure the content into at least 3 logical Sections (slides for decks, panels for brochures).
- For each section, provide a 'title', 'content', and optional 'notes' (speaker notes for decks, or layout/visual suggestions for brochures).
- If {{{isBrochureFormat}}} is true, content should be persuasive, benefit-oriented, and include TEXTUAL suggestions for visuals where appropriate (e.g., "(Visual: Chart showing growth)").
- If {{{isBrochureFormat}}} is false, structure content for slides, suitable for PDF, Word Doc, or PPT outline.

Focus on clarity, conciseness, and relevance to {{{product}}}.
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
      const promptInput: GenerateTrainingMaterialPromptInput = {
        ...input,
        isBrochureFormat: input.deckFormatHint === "Brochure"
      };
      const {output} = await generateTrainingMaterialPrompt(promptInput);
      if (!output) {
        throw new Error("AI failed to generate training material content.");
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
    return await generateTrainingDeckFlow(input);
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
