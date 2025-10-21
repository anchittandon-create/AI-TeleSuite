/**
 * @fileOverview AI-powered product description generator.
 * - generateProductDescription - A function that generates a product description.
 * - GenerateProductDescriptionInput - The input type for the function.
 * - GenerateProductDescriptionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().min(1).describe('The display name of the product for which to generate a description.'),
  brandName: z.string().optional().describe("The official brand name associated with the product. The AI will use this for context."),
  brandUrl: z.string().url().optional().describe("An official URL for the brand or product. This provides additional context."),
});
export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('The AI-generated product description, which should be a concise and compelling summary suitable for a telesales application.'),
});
export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

const generateDescriptionPrompt = ai.definePrompt({
    name: "generateProductDescriptionPrompt",
    input: { schema: GenerateProductDescriptionInputSchema },
    output: { schema: GenerateProductDescriptionOutputSchema },
    prompt: `
        You are an expert product marketer. Your task is to generate a concise, compelling one-sentence product description for a product.
        The description should be suitable for a telesales application's internal reference. Focus on the likely core value or purpose of such a product based on your general knowledge.

        Product Name: "{{productName}}"
        {{#if brandName}}Brand Name: "{{brandName}}"{{/if}}

        Instructions:
        1.  Use your general knowledge about the provided Brand Name and Product Name to generate a description.
        2.  Synthesize this knowledge into a single, engaging sentence that summarizes the product's core value.
        3.  If you have no knowledge of the product or brand, generate a plausible description based on the names alone.
    `,
    model: 'googleai/gemini-2.0-flash',
    config: { temperature: 0.7 },
});


const generateDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async (input) => {
    
    const { output } = await generateDescriptionPrompt(input);
    
    if (!output) {
        throw new Error("AI failed to generate a description. The model returned an empty response.");
    }
    
    return output;
  }
);

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  try {
    return await generateDescriptionFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error(`Catastrophic error in generateProductDescription: ${error.message}`, error);
    let userMessage = `AI failed to generate description. Error: ${error.message}`;
    if (error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('429')) {
      userMessage = "The AI service is currently at its quota limit. Please try again later.";
    } else if (error.message?.toLowerCase().includes('permission denied') || error.message?.toLowerCase().includes('authentication')) {
      userMessage = "AI service authentication failed. Please check the server configuration.";
    }
    return {
      description: `[Error: ${userMessage}]`
    };
  }
}
