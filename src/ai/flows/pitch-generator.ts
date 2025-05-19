
'use server';

/**
 * @fileOverview Generates a tailored sales pitch based on the selected product and customer cohort.
 *
 * - generatePitch - A function that generates the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePitchInputSchema = z.object({
  product: z.enum(['ETPrime', 'TOI+']).describe('The product to pitch.'),
  customerCohort: z.string().describe('The customer cohort to target.'),
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;

const GeneratePitchOutputSchema = z.object({
  headlineHook: z.string().describe('The headline hook of the pitch.'),
  introduction: z.string().describe('The introduction of the pitch.'),
  keyBenefits: z.array(z.string()).describe('The key benefits of the product, elaborated with examples or brief explanations.'),
  pitchBody: z.string().describe('The main body of the sales pitch, designed to last 2-3 minutes when spoken, including pricing information if available or placeholders.'),
  callToAction: z.string().describe('The call to action of the pitch.'),
  estimatedDuration: z.string().describe('Estimated speaking duration of the entire pitch (e.g., "4-5 minutes").')
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  return generatePitchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a telesales expert. Generate a comprehensive sales pitch script for {{product}} targeted at the {{customerCohort}} customer cohort.
The entire pitch should be suitable for a 4-5 minute spoken delivery. Ensure all sections are fully developed and the pitch does not end abruptly.

The pitch must include:
1.  A compelling headline hook.
2.  A brief, engaging introduction.
3.  At least 3-4 key benefits, elaborated with examples or brief explanations to make them impactful and clear.
4.  A main pitch body that flows well, is substantial, and expands on the value proposition, designed to last 2-3 minutes when spoken.
    - **Important for Pricing**: Incorporate current pricing details for {{{product}}}. This information is critically sourced from our internal knowledge base documents: 'A4-26.pdf' (for ETPrime) and 'A4-27.pdf' (for TOI+), which detail current subscription plans and offers.
    - Please present these pricing options clearly within the pitch body or as a distinct section.
    - If you, as the AI, do not have direct access to the live content of A4-26.pdf and A4-27.pdf, you MUST explicitly state: "For the most up-to-date and detailed {{{product}}} pricing, please refer to our official documents A4-26.pdf and A4-27.pdf. I will now outline the general value and benefits, and your sales agent can provide the precise current subscription options." OR, if generating example pricing, clearly state: "Here are some example pricing tiers for {{{product}}}. Please confirm the exact current pricing with your sales agent, who will refer to documents A4-26.pdf and A4-27.pdf."
5.  A clear and fully articulated call to action.
6.  An estimated speaking duration for the entire pitch (e.g., "4-5 minutes").

Double-check that all requested sections are present, fully developed, and the pitch concludes naturally without abruptness.
Output the response in JSON format. Ensure the keyBenefits are detailed, the pitchBody is substantial, and the callToAction is complete.
{
  "headlineHook": "[headline hook]",
  "introduction": "[introduction]",
  "keyBenefits": ["Elaborated benefit 1...", "Elaborated benefit 2...", "Elaborated benefit 3..."],
  "pitchBody": "[Detailed pitch body content, including pricing discussion or clear instructions for the agent regarding A4-26.pdf and A4-27.pdf...]",
  "callToAction": "[call to action]",
  "estimatedDuration": "4-5 minutes"
}`,
});

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // In a more advanced setup, we might try to fetch and inject content from A4-26.pdf/A4-27.pdf here
    // For now, the prompt handles the case where this content is not directly available to the LLM.
    return output!;
  }
);
