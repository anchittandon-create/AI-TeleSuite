
'use server';
/**
 * @fileOverview AI-powered product description generator.
 * - generateProductDescription - A function that generates a product description.
 * - GenerateProductDescriptionInput - The input type for the function.
 * - GenerateProductDescriptionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().min(1).describe('The display name of the product for which to generate a description.'),
  brandName: z.string().optional().describe("The official brand name associated with the product. The AI will use this for web searches."),
  brandUrl: z.string().url().optional().describe("An official URL for the brand or product. The AI will use this to gather context."),
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
        The description should be suitable for a telesales application's internal reference. Focus on the likely core value or purpose of such a product.

        Product Name: "{{productName}}"
        {{#if brandName}}Brand Name: "{{brandName}}"{{/if}}
        {{#if brandUrl}}Brand URL: {{brandUrl}}{{/if}}

        Instructions:
        1.  Use the provided Brand Name and Brand URL as the primary sources for your information.
        2.  If a Brand Name is provided, perform a web search to understand what the company does and what its key value proposition is.
        3.  If a Brand URL is provided, analyze the content on that page to understand the product's features and benefits.
        4.  Synthesize the information from your research into a single, engaging sentence that summarizes the product's core value.
        5.  If you cannot find sufficient information, generate a plausible description based on the product and brand name alone.
    `,
    model: 'googleai/gemini-1.5-flash-latest',
    tools: [googleAI()],
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
        throw new Error("AI failed to generate a description.");
    }
    
    return output;
  }
);

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  return await generateDescriptionFlow(input);
}
