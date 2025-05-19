
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
  pitchBody: z.string().describe('The main body of the sales pitch, designed to last 2-3 minutes when spoken.'),
  callToAction: z.string().describe('The call to action of the pitch.'),
  estimatedDuration: z.string().describe('Estimated speaking duration of the pitch (e.g., "4-5 minutes").')
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
The entire pitch should be suitable for a 4-5 minute spoken delivery.

The pitch must include:
1.  A compelling headline hook.
2.  A brief, engaging introduction.
3.  At least 3-4 key benefits, elaborated with examples or brief explanations to make them impactful.
4.  A main pitch body that flows well and expands on the value proposition, designed to last 2-3 minutes when spoken.
5.  A clear call to action.
6.  An estimated speaking duration for the entire pitch (e.g., "4-5 minutes").

Output the response in JSON format. Ensure the keyBenefits are detailed and the pitchBody is substantial.
{
  "headlineHook": "[headline hook]",
  "introduction": "[introduction]",
  "keyBenefits": ["Elaborated benefit 1...", "Elaborated benefit 2...", "Elaborated benefit 3..."],
  "pitchBody": "[Detailed pitch body content...]",
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
    return output!;
  }
);

