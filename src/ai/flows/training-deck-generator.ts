
'use server';
/**
 * @fileOverview Generates a training deck based on product and knowledge base items.
 *
 * - generateTrainingDeckFlow - A function that handles training deck generation.
 * - GenerateTrainingDeckInput - The input type for the flow.
 * - GenerateTrainingDeckOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Product, PRODUCTS } from '@/types';

const KnowledgeBaseItemSchema = z.object({
  name: z.string().describe("Name of the knowledge base item (e.g., file name or text entry title)."),
  textContent: z.string().optional().describe("Full text content if the item is a text entry."),
  isTextEntry: z.boolean().describe("Whether this item is a direct text entry or a file upload.")
});

const GenerateTrainingDeckInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the training deck is for.'),
  deckFormatHint: z.enum(["PDF", "Word Doc", "PPT"]).describe('The intended output format (influences content structure suggestion).'),
  knowledgeBaseItems: z.array(KnowledgeBaseItemSchema).describe('An array of selected knowledge base items. For files, only the name is provided as context. For text entries, full textContent is available.'),
  generateFromAllKb: z.boolean().describe('If true, knowledgeBaseItems represents the entire KB relevant to the product.'),
});
export type GenerateTrainingDeckInput = z.infer<typeof GenerateTrainingDeckInputSchema>;

const SlideSchema = z.object({
  title: z.string().describe("The title of this slide."),
  content: z.string().describe("The main content for this slide, formatted with bullet points or paragraphs as appropriate for a training deck. Keep content concise for each slide."),
  notes: z.string().optional().describe("Optional speaker notes for this slide.")
});

const GenerateTrainingDeckOutputSchema = z.object({
  deckTitle: z.string().describe("The overall title for the training deck."),
  slides: z.array(SlideSchema).min(5).describe("An array of at least 5 slides. Include an introduction, several content slides covering key aspects of the product, and a conclusion/Q&A slide."),
});
export type GenerateTrainingDeckOutput = z.infer<typeof GenerateTrainingDeckOutputSchema>;


export async function generateTrainingDeck(input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> {
  return generateTrainingDeckFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTrainingDeckPrompt',
  input: {schema: GenerateTrainingDeckInputSchema},
  output: {schema: GenerateTrainingDeckOutputSchema},
  prompt: `You are an expert instructional designer tasked with creating a training deck.
Product: {{{product}}}
Intended Output Format (for content structuring hint): {{{deckFormatHint}}}

Knowledge Base Context:
{{#if generateFromAllKb}}
The deck should be comprehensive based on general knowledge of the {{{product}}} and the following key topics/documents from the knowledge base.
{{else}}
The deck should be focused on content related to the {{{product}}} and inspired by the following selected items from the knowledge base.
{{/if}}

{{#each knowledgeBaseItems}}
- Item Name: "{{this.name}}"
  {{#if this.isTextEntry}}
  Content: "{{this.textContent}}"
  {{else}}
  (This is a file upload, consider its name as a topic for the deck if relevant)
  {{/if}}
{{/each}}

Instructions:
1.  Create a 'deckTitle' that is appropriate for a training deck on the {{{product}}}.
2.  Generate a minimum of 5 'slides'. Each slide must have a 'title' and 'content'.
3.  The slides should cover:
    *   An introduction to the {{{product}}}.
    *   Key features and benefits of the {{{product}}}.
    *   Common use cases or selling points.
    *   Handling common questions or objections related to {{{product}}} (if information is available or can be inferred).
    *   A concluding slide (e.g., summary, Q&A, next steps).
4.  For 'content' within each slide:
    *   Keep it concise and easy to understand for training purposes. Use bullet points where appropriate.
    *   If {{{deckFormatHint}}} is "PPT", structure content as if it were for PowerPoint slides (short bullet points, key phrases).
    *   If {{{deckFormatHint}}} is "Word Doc" or "PDF", content can be slightly more detailed but still structured for readability.
5.  If specific knowledge base items provide useful direct text (from 'isTextEntry: true' items), incorporate or adapt that text naturally into the slide content.
6.  For file uploads (where 'isTextEntry: false'), use their names as indicators of topics that might be relevant to include in the training for {{{product}}}. You cannot read the content of these files.
7.  Focus on creating practical, useful training material for sales agents regarding the {{{product}}}.
8.  Do NOT include any instructions for the agent to offer free trials or discounts unless explicitly part of the provided knowledge base item content that you are referencing.

Output the entire response in the specified JSON format. Ensure the 'slides' array has at least 5 well-developed slides.
`,
});

const generateTrainingDeckFlow = ai.defineFlow(
  {
    name: 'generateTrainingDeckFlow',
    inputSchema: GenerateTrainingDeckInputSchema,
    outputSchema: GenerateTrainingDeckOutputSchema,
  },
  async (input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> => {
    // In a real scenario with a large KB, you might filter/select top N items if generateFromAllKb is true
    // For now, we assume knowledgeBaseItems is already appropriately populated client-side.

    const {output} = await prompt(input);
    if (!output) {
        console.error("Training Deck generation flow: Prompt returned null output for input:", input.product);
        // Provide a fallback error structure
        return {
            deckTitle: `Error Generating Deck for ${input.product}`,
            slides: [
                { title: "Error", content: "The AI failed to generate training deck content. Please try again or check the input parameters." },
                { title: "Troubleshooting", content: "Ensure knowledge base items are relevant and product selection is correct."}
            ]
        };
    }
    return output;
  }
);
