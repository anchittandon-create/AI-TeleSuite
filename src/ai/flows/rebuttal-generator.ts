
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent.
 *
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { PRODUCTS } from '@/types'; // Import PRODUCTS

const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the customer is objecting to.'), // Updated
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;

export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  return generateRebuttalFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRebuttalPrompt',
  input: {schema: GenerateRebuttalInputSchema},
  output: {schema: GenerateRebuttalOutputSchema},
  prompt: `You are a sales expert specializing in rebuttals for ET and TOI subscriptions.

  Given the customer's objection and the product they are objecting to, generate a contextual rebuttal that addresses their concern and encourages them to subscribe.
  IMPORTANT: Do NOT suggest offering a free trial to the user to overcome the objection. Focus on the value of the subscription and other persuasive techniques.

  Objection: {{{objection}}}
  Product: {{{product}}}
  \n  Rebuttal:`,
});

const generateRebuttalFlow = ai.defineFlow(
  {
    name: 'generateRebuttalFlow',
    inputSchema: GenerateRebuttalInputSchema,
    outputSchema: GenerateRebuttalOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
