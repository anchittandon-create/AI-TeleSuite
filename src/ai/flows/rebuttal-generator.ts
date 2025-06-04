
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent.
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { PRODUCTS } from '@/types'; 

export const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the customer is objecting to.'),
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

export const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;

const generateRebuttalPrompt = ai.definePrompt({
  name: 'generateRebuttalPrompt',
  input: {schema: GenerateRebuttalInputSchema},
  output: {schema: GenerateRebuttalOutputSchema},
  prompt: `You are an expert sales coach. A customer has raised an objection to the product '{{{product}}}'.
Customer's Objection: "{{{objection}}}"

Provide a concise, effective, and empathetic rebuttal. Consider the product's key benefits when formulating the response.
For ET (Economic Times), focus on value from ETPrime, exclusive insights, and ad-light experience.
For TOI (Times of India), focus on comprehensive news, trusted brand, and digital features.
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
    try {
      const {output} = await generateRebuttalPrompt(input);
      if (!output) {
        console.error("generateRebuttalFlow: Prompt returned no output.");
        throw new Error("AI failed to generate rebuttal.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generateRebuttalFlow:", error);
      return {
        rebuttal: `Error generating rebuttal: ${error.message}. Ensure Google API Key is set and valid.`
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
      rebuttal: `Critical Error: Rebuttal Generation Failed: ${error.message}. Check server logs.`
    };
  }
}
