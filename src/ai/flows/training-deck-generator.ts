
'use server';
/**
 * @fileOverview Generates a training deck or brochure content based on product and knowledge base items, direct file uploads, or a direct user prompt.
 *
 * - generateTrainingDeckFlow - A function that handles training deck/brochure generation.
 * - GenerateTrainingDeckInput - The input type for the flow.
 * - GenerateTrainingDeckOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Product, PRODUCTS } from '@/types';

const KnowledgeBaseItemSchema = z.object({
  name: z.string().describe("Name of the knowledge base item (e.g., file name, text entry title, or 'User-Provided Prompt')."),
  textContent: z.string().optional().describe("Full text content if the item is a text entry from KB, a small directly uploaded text file, or the direct user prompt."),
  isTextEntry: z.boolean().describe("Whether this item is a direct text entry from the KB or a direct user prompt."),
  fileType: z.string().optional().describe("MIME type of the file, if applicable (especially for direct uploads). Will be 'text/plain' for prompts.")
});
export type FlowKnowledgeBaseItemSchema = z.infer<typeof KnowledgeBaseItemSchema>; // Export for UI type use

const GenerateTrainingDeckInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the training material is for.'),
  deckFormatHint: z.enum(["PDF", "Word Doc", "PPT", "Brochure"]).describe('The intended output format (influences content structure suggestion).'),
  knowledgeBaseItems: z.array(KnowledgeBaseItemSchema).describe('An array of contextual items: selected KB items, items derived from direct file uploads, OR a single item representing a direct user prompt. For KB files or larger/binary direct uploads, only name/type is primary context unless textContent is provided. For text entries from KB or direct prompts, full textContent is available.'),
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


export async function generateTrainingDeck(input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> {
  try {
    return await generateTrainingDeckFlow(input);
  } catch (e) {
    console.error("Catastrophic error in generateTrainingDeck flow INVOCATION:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected catastrophic error occurred invoking the training material generation flow.";
    const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
    return {
      deckTitle: `System Error Generating ${materialType} for ${input.product}`,
      sections: [
          { title: "Critical System Error", content: `Failed to generate material: ${errorMessage.substring(0,200)}. Ensure API key is set in .env.` },
          { title: "Details", content: "The system encountered a critical issue processing your request. Please try again later or contact support if the problem persists."}
      ]
    };
  }
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
If a single contextual item is provided and it is a text entry (like a direct user prompt), it should be treated as the primary and detailed specification for the entire training material.
For other items (KB text entries, small uploaded text files), use their 'textContent' directly to inform your generation.
For file uploads (from KB or larger/binary direct uploads) where only 'name' and 'fileType' are available, their 'name' and 'fileType' indicate topics or types of information. You must generate relevant content inspired by these topics; you cannot read their internal content but should infer potential themes.

Contextual Items:
{{#each knowledgeBaseItems}}
- Item Name: "{{this.name}}"
  Type: {{#if this.isTextEntry}}User-Provided Prompt / KB Text Entry{{else}}{{this.fileType}}{{/if}}
  {{#if this.textContent}}
  (Source: Direct Text Input - Use this content as primary instruction if it's the sole item, or integrate if multiple items present)
  Content: "{{this.textContent}}"
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
*   **Visual Suggestions:** For each panel/section, explicitly suggest visuals WITHIN THE 'content' or 'notes'. Describe the type of visual (e.g., product photo, icon, lifestyle image, abstract background, graph), its purpose, and potential placement. Example for 'content': "Discover the Future of News (Visual Suggestion: A high-quality photo of the {{{product}}} in use by a potential customer. This should convey ease of use and satisfaction. Placement: Prominently on this panel.) Key benefits include..." Example for 'notes': "Visual Idea: Main visual for this panel could be an abstract representation of data insights with icons for speed, accuracy, depth."
*   Ensure one section serves as a strong Call to Action (CTA).
*   'notes' can be used for internal suggestions like "Use a vibrant background color here," "Feature a customer testimonial," or more detailed visual placement notes if not in content.
{{else}}
Instructions for "PDF", "Word Doc", or "PPT" (Deck) formats ({{{deckFormatHint}}}):
*   Generate at least 5 'sections' (slides).
*   The sections should cover topics derived from the provided context. If the context is a single detailed prompt, adhere to its structure. Otherwise, for multiple items or file references, aim for:
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
*   If specific knowledge base items provide useful direct text (from 'isTextEntry: true' items, directly uploaded text files with 'textContent', or a user prompt), incorporate or adapt that text naturally into the section content. If a single user prompt is the ONLY context, it is the primary driver for content.
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
    try {
      const promptInput: GenerateTrainingMaterialPromptInput = {
        ...input,
        isBrochureFormat: input.deckFormatHint === "Brochure",
      };

      const {output} = await prompt(promptInput); 

      if (!output) {
          console.error("Training Material generation flow: Prompt returned null output for input:", input.product, input.deckFormatHint, input.sourceDescriptionForAi);
          const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
          const errorMessage = "AI prompt returned no output. Check input parameters, contextual items, and API key. Ensure API key is set in .env.";
          return {
              deckTitle: `Error Generating ${materialType} for ${input.product}`,
              sections: [
                  { title: "Error", content: `The AI failed to generate ${materialType.toLowerCase()} content. ${errorMessage}` },
                  { title: "Troubleshooting", content: "Ensure contextual items are relevant and product selection is correct. The AI might have encountered an internal issue or could not process the request."}
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
    } catch (flowError) {
      console.error("Critical error in generateTrainingDeckFlow execution:", flowError);
      const errorMessage = flowError instanceof Error ? flowError.message : "An unexpected critical error occurred in the training material generation flow.";
      const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
      return {
        deckTitle: `System Error Generating ${materialType} for ${input.product}`,
        sections: [
            { title: "System Error", content: `Failed to generate material: ${errorMessage.substring(0,200)}. Ensure API key is set in .env.` },
            { title: "Details", content: "The system encountered an issue processing your request. Please try again later."}
        ]
      };
    }
  }
);

// Make FlowKnowledgeBaseItemSchema available for import if needed in UI components for type consistency
export type { FlowKnowledgeBaseItemSchema as TrainingDeckFlowKnowledgeBaseItem };

