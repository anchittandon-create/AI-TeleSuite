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
  keyBenefits: z.array(z.string()).describe('The key benefits of the product.'),
  callToAction: z.string().describe('The call to action of the pitch.'),
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  return generatePitchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a telesales expert. Generate a sales pitch for {{product}} targeted at the {{customerCohort}} customer cohort. The pitch should include a headline hook, introduction, 3 key benefits, and a call to action.

Output the response in JSON format:
{
  "headlineHook": "[headline hook]",
  "introduction": "[introduction]",
  "keyBenefits": ["benefit 1", "benefit 2", "benefit 3"],
  "callToAction": "[call to action]"
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
    return output!;
  }
);
