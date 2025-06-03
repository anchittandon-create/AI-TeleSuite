
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
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the customer is objecting to.'),
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;

export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  try {
    return await generateRebuttalFlow(input);
  } catch (e) {
    console.error("Catastrophic error in generateRebuttal flow INVOCATION:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected catastrophic error occurred invoking the rebuttal generation flow.";
    return {
      rebuttal: `System Error: Rebuttal generation failed catastrophically. ${errorMessage.substring(0,200)}. Ensure API key is set in .env.`
    };
  }
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
  async (input : GenerateRebuttalInput) : Promise<GenerateRebuttalOutput> => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        console.error("Rebuttal generation flow: Prompt returned null output for input:", input);
        return { rebuttal: "Error: Could not generate a rebuttal at this time. The AI prompt returned no output. Please try again or check API key. Ensure API key is set in .env." };
      }
      return output;
    } catch (flowError) {
      console.error("Critical error in generateRebuttalFlow execution:", flowError);
      const errorMessage = flowError instanceof Error ? flowError.message : "An unexpected critical error occurred in the rebuttal generation flow.";
      return {
        rebuttal: `Error: Rebuttal generation failed due to a system error: ${errorMessage.substring(0,200)}. Ensure API key is set in .env.`
      };
    }
  }
);

