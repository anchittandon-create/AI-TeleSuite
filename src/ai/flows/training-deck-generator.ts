
'use server';
/**
 * @fileOverview Generates a training deck or brochure content based on product and knowledge base items, direct file uploads, or a direct user prompt.
 * Genkit has been removed. This flow will return placeholder error messages.
 * - generateTrainingDeckFlow - A function that handles training deck/brochure generation.
 * - GenerateTrainingDeckInput - The input type for the flow.
 * - GenerateTrainingDeckOutput - The return type for the flow.
 */

// import {ai} from '@/ai/genkit'; // Genkit removed
import {z} from 'genkit';
import { Product, PRODUCTS } from '@/types';

const KnowledgeBaseItemSchema = z.object({
  name: z.string().describe("Name of the knowledge base item (e.g., file name, text entry title, or 'User-Provided Prompt')."),
  textContent: z.string().optional().describe("Full text content if the item is a text entry from KB, a small directly uploaded text file, or the direct user prompt."),
  isTextEntry: z.boolean().describe("Whether this item is a direct text entry from the KB or a direct user prompt."),
  fileType: z.string().optional().describe("MIME type of the file, if applicable (especially for direct uploads). Will be 'text/plain' for prompts.")
});
export type FlowKnowledgeBaseItemSchema = z.infer<typeof KnowledgeBaseItemSchema>; 

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
  sections: z.array(ContentSectionSchema).min(1).describe("An array of at least 1 section/slide/panel. For decks: intro, content, conclusion. For brochures: cover panel, internal panels, call-to-action panel."), // Min changed to 1 for error case
});
export type GenerateTrainingDeckOutput = z.infer<typeof GenerateTrainingDeckOutputSchema>;

// Internal schema for the prompt, including the derived boolean flag
// const GenerateTrainingMaterialPromptInputSchema = GenerateTrainingDeckInputSchema.extend({ // Genkit removed
//   isBrochureFormat: z.boolean().describe("True if the deckFormatHint is 'Brochure', false otherwise.")
// });
// type GenerateTrainingMaterialPromptInput = z.infer<typeof GenerateTrainingMaterialPromptInputSchema>;

export async function generateTrainingDeck(input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> {
  console.warn("Training Material Creator: Genkit has been removed. Returning placeholder error response.");
  const errorMessage = "Training Material creation feature is disabled as AI Service (Genkit) has been removed.";
  try {
    GenerateTrainingDeckInputSchema.parse(input); // Basic validation
    return Promise.resolve({
      deckTitle: `Error Generating ${input.deckFormatHint} - AI Disabled`,
      sections: [
        { title: "Feature Disabled", content: errorMessage, notes: "AI service (Genkit) is not available." }
      ]
    });
  } catch (e) {
    const error = e as Error;
    console.error("Error in disabled generateTrainingDeck function (likely input validation):", error);
    const validationErrorMessage = `Input Error: ${error.message}. ${errorMessage}`;
    return Promise.resolve({
      deckTitle: "Input Error or AI Feature Disabled",
      sections: [
        { title: "Error", content: validationErrorMessage, notes: "Please check input parameters." }
      ]
    });
  }
}

// const prompt = ai.definePrompt({ // Genkit removed
//   name: 'generateTrainingMaterialPrompt',
//   // ...
// });

// const generateTrainingDeckFlow = ai.defineFlow( // Genkit removed
//   {
//     name: 'generateTrainingDeckFlow',
//     inputSchema: GenerateTrainingDeckInputSchema, 
//     outputSchema: GenerateTrainingDeckOutputSchema,
//   },
//   async (input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> => {
//     // ... original logic ...
//     throw new Error("generateTrainingDeckFlow called but Genkit is removed.");
//   }
// );

export type { FlowKnowledgeBaseItemSchema as TrainingDeckFlowKnowledgeBaseItem };
