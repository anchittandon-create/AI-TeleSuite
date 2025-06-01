
'use server';
/**
 * @fileOverview Generates a training deck or brochure content based on product and knowledge base items or direct file uploads.
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
  textContent: z.string().optional().describe("Full text content if the item is a text entry from KB, or partial content from a small directly uploaded text file."),
  isTextEntry: z.boolean().describe("Whether this item is a direct text entry from the KB."),
  fileType: z.string().optional().describe("MIME type of the file, if applicable (especially for direct uploads).")
});

const GenerateTrainingDeckInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the training material is for.'),
  deckFormatHint: z.enum(["PDF", "Word Doc", "PPT", "Brochure"]).describe('The intended output format (influences content structure suggestion).'),
  knowledgeBaseItems: z.array(KnowledgeBaseItemSchema).describe('An array of selected knowledge base items OR items derived from direct file uploads. For KB files, only name is provided as context unless it is a text entry. For text entries from KB, full textContent is available. For direct uploads, name and type are primary context; textContent might be available for small text files.'),
  generateFromAllKb: z.boolean().describe('If true, knowledgeBaseItems represents the entire KB relevant to the product (and direct uploads are ignored).'),
  sourceDescriptionForAi: z.string().optional().describe("A brief description of the source of the knowledgeBaseItems (e.g., 'selected KB items', 'entire KB for ET', 'directly uploaded files: report.docx, notes.txt'). This helps the AI understand the context source.")
});
export type GenerateTrainingDeckInput = z.infer<typeof GenerateTrainingDeckInputSchema>;

const ContentSectionSchema = z.object({
  title: z.string().describe("The title of this section/slide/panel."),
  content: z.string().describe("The main content for this section, formatted with bullet points, paragraphs, or concise statements as appropriate for the target format. Keep content focused for each section. For brochures, content should be persuasive and benefit-oriented, suggesting where visuals might go, e.g., (Image: Happy customer using product)."),
  notes: z.string().optional().describe("Optional speaker notes for slides, or internal notes/suggestions for brochure panels (e.g., 'Use vibrant background', 'Feature customer testimonial').")
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
  input: {schema: GenerateTrainingMaterialPromptInputSchema}, 
  output: {schema: GenerateTrainingDeckOutputSchema},
  prompt: `You are an expert instructional designer and marketing content creator.
Product: {{{product}}}
Intended Output Format: {{{deckFormatHint}}}

Context Source: {{{sourceDescriptionForAi}}}
The training material should be generated based on the product and the following contextual items.
For items marked as 'isTextEntry: true' (from Knowledge Base text entries) or items with provided 'textContent' (from small direct text file uploads), use their content directly to inform your generation.
For other items (file uploads from KB or larger/binary direct uploads), their 'name' and 'fileType' indicate topics or types of information. You must generate relevant content inspired by these topics; you cannot read their internal content but should infer potential themes.

Contextual Items:
{{#each knowledgeBaseItems}}
- Item Name: "{{this.name}}"
  Type: {{#if this.isTextEntry}}KB Text Entry{{else}}{{this.fileType}}{{/if}}
  {{#if this.isTextEntry}}
  (Source: Knowledge Base Text Entry - Use this content directly)
  Content Summary: "{{this.textContent}}"
  {{else if this.textContent}}
  (Source: Directly Uploaded Text File - Use this content directly)
  Content Summary: "{{this.textContent}}"
  {{else}}
  (Source: {{#if ../generateFromAllKb}}Knowledge Base File (Infer topic from name: {{this.name}}){{else if ../sourceDescriptionForAi}}{{{../sourceDescriptionForAi}}} (Infer topic from name: {{this.name}}){{else}}File Reference (Infer topic from name: {{this.name}}){{/if}} - Content NOT directly readable by AI, use name/type as topic inspiration)
  {{/if}}
{{/each}}

Instructions:
1.  Create a 'deckTitle' appropriate for the {{{product}}} and the selected '{{{deckFormatHint}}}'.
2.  Generate a minimum of 3 'sections' (representing slides for a deck, or panels/sections for a brochure). Each section must have a 'title' and 'content'.

{{#if isBrochureFormat}}
Instructions for "Brochure" format ({{{deckFormatHint}}}):
*   The 'sections' should represent panels or distinct areas of a brochure (e.g., tri-fold: Cover, Inner Panel 1, Inner Panel 2, Inner Panel 3 (CTA), Back Panel). Aim for 3-5 key sections.
*   'title' for each section should be a catchy headline for that panel.
*   'content' should be concise, persuasive, and benefit-oriented. Use strong marketing language. Highlight key selling points and unique value.
*   **Visual Suggestions:** For each panel/section, explicitly suggest visuals. Describe the type of visual (e.g., product photo, icon, lifestyle image, abstract background, graph) and its purpose. Example: "(Visual Suggestion: A high-quality photo of the {{{product}}} in use by a potential customer. This should convey ease of use and satisfaction. Placement: Prominently on this panel.)" or "(Visual Suggestion: A set of 3 icons representing key benefits like [Benefit1], [Benefit2], [Benefit3]. Placement: Above the bullet points related to these benefits.)" Ensure these suggestions are integrated naturally within the content or notes for the panel.
*   Ensure one section serves as a strong Call to Action (CTA).
*   'notes' can be used for internal suggestions like "Use a vibrant background color here," "Feature a customer testimonial," or more detailed visual placement notes if not in content.
{{else}}
Instructions for "PDF", "Word Doc", or "PPT" (Deck) formats ({{{deckFormatHint}}}):
*   Generate at least 5 'sections' (slides).
*   The sections should cover:
    *   An introduction to the {{{product}}}.
    *   Key features and benefits of the {{{product}}}.
    *   Common use cases or selling points.
    *   Handling common questions or objections (if information is available from textContent of items).
    *   A concluding section (e.g., summary, Q&A, next steps).
*   For 'content' within each section:
    *   Keep it concise and easy to understand for training. Use bullet points where appropriate.
    *   If {{{deckFormatHint}}} is "PPT", structure content for PowerPoint slides (short bullets, key phrases).
    *   If {{{deckFormatHint}}} is "Word Doc" or "PDF", content can be slightly more detailed but still structured for readability.
*   'notes' can be used for speaker notes for each slide.
{{/if}}

General Instructions for all formats:
*   If specific knowledge base items provide useful direct text (from 'isTextEntry: true' items or directly uploaded text files with 'textContent'), incorporate or adapt that text naturally into the section content.
*   For file uploads where only 'name' and 'fileType' are available as context, use their names as indicators of topics that might be relevant to include. You must generate plausible content for these topics related to the {{{product}}}.
*   Focus on creating practical, useful material for sales agents or customers regarding the {{{product}}}.
*   Do NOT include any instructions to offer free trials or discounts unless explicitly part of the provided 'textContent' you are referencing.

Output the entire response in the specified JSON format.
Ensure the 'sections' array has at least 3 well-developed sections (or 5 for decks).
`,
});

const generateTrainingDeckFlow = ai.defineFlow(
  {
    name: 'generateTrainingDeckFlow',
    inputSchema: GenerateTrainingDeckInputSchema, 
    outputSchema: GenerateTrainingDeckOutputSchema,
  },
  async (input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> => {
    const promptInput: GenerateTrainingMaterialPromptInput = {
      ...input,
      isBrochureFormat: input.deckFormatHint === "Brochure",
    };

    const {output} = await prompt(promptInput); 

    if (!output) {
        console.error("Training Material generation flow: Prompt returned null output for input:", input.product, input.deckFormatHint, input.sourceDescriptionForAi);
        const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
        return {
            deckTitle: `Error Generating ${materialType} for ${input.product}`,
            sections: [
                { title: "Error", content: `The AI failed to generate ${materialType.toLowerCase()} content. Please try again or check the input parameters and contextual items.` },
                { title: "Troubleshooting", content: "Ensure contextual items are relevant and product selection is correct. The AI might have encountered an internal issue."}
            ]
        };
    }
    
    const minSections = input.deckFormatHint === "Brochure" ? 3 : 5;
    if (output.sections.length < minSections) {
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

