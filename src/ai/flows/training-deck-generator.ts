
'use server';
/**
 * @fileOverview Generates a training deck or brochure content based on product and knowledge base items.
 *
 * - generateTrainingDeckFlow - A function that handles training deck/brochure generation.
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
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the training material is for.'),
  deckFormatHint: z.enum(["PDF", "Word Doc", "PPT", "Brochure"]).describe('The intended output format (influences content structure suggestion).'),
  knowledgeBaseItems: z.array(KnowledgeBaseItemSchema).describe('An array of selected knowledge base items. For files, only the name is provided as context. For text entries, full textContent is available.'),
  generateFromAllKb: z.boolean().describe('If true, knowledgeBaseItems represents the entire KB relevant to the product.'),
});
export type GenerateTrainingDeckInput = z.infer<typeof GenerateTrainingDeckInputSchema>;

const ContentSectionSchema = z.object({
  title: z.string().describe("The title of this section/slide/panel."),
  content: z.string().describe("The main content for this section, formatted with bullet points, paragraphs, or concise statements as appropriate for the target format. Keep content focused for each section."),
  notes: z.string().optional().describe("Optional speaker notes for slides, or internal notes/suggestions for brochure panels.")
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


export async function generateTrainingDeck(input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> {
  return generateTrainingDeckFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTrainingMaterialPrompt',
  input: {schema: GenerateTrainingMaterialPromptInputSchema}, // Use the extended schema
  output: {schema: GenerateTrainingDeckOutputSchema},
  prompt: `You are an expert instructional designer and marketing content creator.
Product: {{{product}}}
Intended Output Format: {{{deckFormatHint}}}

Knowledge Base Context:
{{#if generateFromAllKb}}
The material should be comprehensive based on general knowledge of the {{{product}}} and the following key topics/documents from the knowledge base.
{{else}}
The material should be focused on content related to the {{{product}}} and inspired by the following selected items from the knowledge base.
{{/if}}

{{#each knowledgeBaseItems}}
- Item Name: "{{this.name}}"
  {{#if this.isTextEntry}}
  Content: "{{this.textContent}}"
  {{else}}
  (This is a file upload, consider its name as a topic if relevant)
  {{/if}}
{{/each}}

Instructions:
1.  Create a 'deckTitle' appropriate for the {{{product}}} and the selected '{{{deckFormatHint}}}'.
2.  Generate a minimum of 3 'sections' (representing slides for a deck, or panels/sections for a brochure). Each section must have a 'title' and 'content'.

{{#if isBrochureFormat}}
Instructions for "Brochure" format:
*   The 'sections' should represent panels or distinct areas of a brochure (e.g., tri-fold: Cover, Inner Panel 1, Inner Panel 2, Inner Panel 3 (CTA), Back Panel). Aim for 3-5 key sections.
*   'title' for each section should be a catchy headline for that panel.
*   'content' should be concise, persuasive, and benefit-oriented. Use strong marketing language. Highlight key selling points and unique value.
*   Suggest where visuals or graphics could be placed by describing them in parentheses, e.g., "(Image: Happy customer using the product)".
*   Ensure one section serves as a strong Call to Action (CTA).
*   'notes' can be used for internal suggestions, like "Use a vibrant background color here" or "Feature a customer testimonial".
{{else}}
Instructions for "PDF", "Word Doc", or "PPT" (Deck) formats:
*   Generate at least 5 'sections' (slides).
*   The sections should cover:
    *   An introduction to the {{{product}}}.
    *   Key features and benefits of the {{{product}}}.
    *   Common use cases or selling points.
    *   Handling common questions or objections (if information is available).
    *   A concluding section (e.g., summary, Q&A, next steps).
*   For 'content' within each section:
    *   Keep it concise and easy to understand for training. Use bullet points where appropriate.
    *   If {{{deckFormatHint}}} is "PPT", structure content for PowerPoint slides (short bullets, key phrases).
    *   If {{{deckFormatHint}}} is "Word Doc" or "PDF", content can be slightly more detailed but still structured for readability.
*   'notes' can be used for speaker notes for each slide.
{{/if}}

General Instructions for all formats:
*   If specific knowledge base items provide useful direct text (from 'isTextEntry: true' items), incorporate or adapt that text naturally into the section content.
*   For file uploads (where 'isTextEntry: false'), use their names as indicators of topics that might be relevant to include. You cannot read the content of these files.
*   Focus on creating practical, useful material for sales agents or customers regarding the {{{product}}}.
*   Do NOT include any instructions to offer free trials or discounts unless explicitly part of the provided knowledge base item content that you are referencing.

Output the entire response in the specified JSON format.
Ensure the 'sections' array has at least 3 well-developed sections (or 5 for decks).
`,
});

const generateTrainingDeckFlow = ai.defineFlow(
  {
    name: 'generateTrainingDeckFlow',
    inputSchema: GenerateTrainingDeckInputSchema, // Flow input remains the original schema
    outputSchema: GenerateTrainingDeckOutputSchema,
  },
  async (input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> => {
    // Prepare input for the prompt, including the derived boolean flag
    const promptInput: GenerateTrainingMaterialPromptInput = {
      ...input,
      isBrochureFormat: input.deckFormatHint === "Brochure",
    };

    const {output} = await prompt(promptInput); // Call prompt with the modified input

    if (!output) {
        console.error("Training Material generation flow: Prompt returned null output for input:", input.product, input.deckFormatHint);
        const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
        return {
            deckTitle: `Error Generating ${materialType} for ${input.product}`,
            sections: [
                { title: "Error", content: `The AI failed to generate ${materialType.toLowerCase()} content. Please try again or check the input parameters.` },
                { title: "Troubleshooting", content: "Ensure knowledge base items are relevant and product selection is correct. The AI might have encountered an internal issue."}
            ]
        };
    }
    // Ensure minimum number of sections based on type
    const minSections = input.deckFormatHint === "Brochure" ? 3 : 5;
    if (output.sections.length < minSections) {
        // If AI didn't generate enough, pad with placeholder error sections
        for (let i = output.sections.length; i < minSections; i++) {
            output.sections.push({
                title: `Placeholder Section ${i + 1}`,
                content: `AI did not generate sufficient content for this section. Target was ${minSections} sections. Please regenerate or review inputs.`,
                notes: "This is an automatically added placeholder due to insufficient AI output."
            });
        }
         output.deckTitle += " (Partially Generated)";
    }

    return output;
  }
);

