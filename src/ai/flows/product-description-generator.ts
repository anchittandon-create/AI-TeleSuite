
'use server';
/**
 * @fileOverview AI-powered product description generator.
 * - generateProductDescription - A function that generates a product description.
 * - GenerateProductDescriptionInput - The input type for the function.
 * - GenerateProductDescriptionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().min(1).describe('The name of the product for which to generate a description.'),
});
export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('The AI-generated product description.'),
});
export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

const generateDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async (input) => {
    const prompt = `Generate a concise, compelling one-sentence product description for a product named "${input.productName}". The description should be suitable for a telesales application's internal reference. Focus on the likely core value or purpose of such a product.`;

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt,
      output: {
        schema: z.object({
          description: z.string(),
        }),
        format: "json"
      },
      config: { temperature: 0.7 },
    });
    
    if (!output) {
        throw new Error("AI failed to generate a description.");
    }
    
    return { description: output.description };
  }
);

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  return await generateDescriptionFlow(input);
}
