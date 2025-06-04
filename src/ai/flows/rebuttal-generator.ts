
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { PRODUCTS } from '@/types'; 

const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the customer is objecting to.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the sole source for rebuttal generation.')
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection, derived exclusively from the Knowledge Base.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;

const generateRebuttalPrompt = ai.definePrompt({
  name: 'generateRebuttalPrompt',
  input: {schema: GenerateRebuttalInputSchema},
  output: {schema: GenerateRebuttalOutputSchema},
  prompt: `You are an expert sales coach. A customer has raised an objection to the product '{{{product}}}'.
Customer's Objection: "{{{objection}}}"

Knowledge Base Context for '{{{product}}}':
{{{knowledgeBaseContext}}}

Provide a concise, effective, and empathetic rebuttal based *exclusively* on the provided Knowledge Base Context.
Formulate the response using benefits, features, or counter-points found within the Knowledge Base Context.
Do not use information outside of the provided Knowledge Base Context. If the Knowledge Base is insufficient to address the objection, state that.
`,
  model: 'googleai/gemini-2.0-flash'
});

const generateRebuttalFlow = ai.defineFlow(
  {
    name: 'generateRebuttalFlow',
    inputSchema: GenerateRebuttalInputSchema,
    outputSchema: GenerateRebuttalOutputSchema,
  },
  async (input : GenerateRebuttalInput) : Promise<GenerateRebuttalOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      return {
        rebuttal: "Cannot generate rebuttal: No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base for this product to enable rebuttal generation."
      };
    }
    try {
      const {output} = await generateRebuttalPrompt(input);
      if (!output) {
        console.error("generateRebuttalFlow: Prompt returned no output.");
        throw new Error("AI failed to generate rebuttal from Knowledge Base.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generateRebuttalFlow:", error);
      return {
        rebuttal: `Error generating rebuttal: ${error.message}. Ensure relevant Knowledge Base content exists for '${input.product}' and that the API Key is valid.`
      };
    }
  }
);

export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  try {
    return await generateRebuttalFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generateRebuttalFlow:", error);
    return {
      rebuttal: `Critical Error: Rebuttal Generation Failed: ${error.message}. Check server logs and Knowledge Base for '${input.product}'.`
    };
  }
}
