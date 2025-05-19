
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
import { Product, PRODUCTS, ETPrimePlanType, ETPRIME_PLAN_TYPES } from '@/types';

const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch.'),
  customerCohort: z.string().describe('The customer cohort to target.'),
  etPrimePlanType: z.enum(ETPRIME_PLAN_TYPES).optional().describe('The specific ETPrime plan duration (1-Year, 3-Year, 7-Year). Only applicable if product is ETPrime.'),
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
  prompt: `You are a telesales expert. Your goal is to generate a comprehensive sales pitch script for {{product}} targeted at the {{customerCohort}} customer cohort.
The language should be simple, direct, and persuasive, suitable for a sales agent to use effectively to close a sale.
The entire pitch should be suitable for a 4-5 minute spoken delivery. Ensure all sections are fully developed and the pitch does not end abruptly.

The pitch must include:
1.  A compelling headline hook.
2.  A brief, engaging introduction.
3.  At least 3-4 key benefits, elaborated with examples or brief explanations to make them impactful and clear.
4.  A main pitch body that flows well, is substantial, and expands on the value proposition, designed to last 2-3 minutes when spoken.
    - **Pricing for ETPrime (The Economic Times Subscription)**:
        {{#if etPrimePlanType}}
        You have selected the {{etPrimePlanType}} plan for ETPrime. Incorporate the following pricing into the pitch:
            {{#if (eq etPrimePlanType "1-Year")}}
            - **1-Year Plan**: "You can get exclusive insights from The Economic Times for just ₹214 per month. This is billed as ₹2565 for the entire year. As a special offer, you'll also get an additional ₹150 discount if you pay with a credit card. This means you save 45% on the usual price!"
            {{/if}}
            {{#if (eq etPrimePlanType "3-Year")}}
            - **3-Year Plan**: "For even greater savings, our 3-year ETPrime plan is available at an effective price of only ₹153 per month. The total for three years is ₹5497. Plus, there's an extra ₹400 discount if you use a credit card. This is a fantastic 45% saving!"
            {{/if}}
            {{#if (eq etPrimePlanType "7-Year")}}
            - **7-Year Plan**: "To get the absolute best value, the 7-year ETPrime plan works out to just ₹108 per month. The total billed amount for seven years is ₹9163. And you get an additional ₹500 off with credit card payments! This incredible offer also gives you a 45% discount."
            {{/if}}
        Make sure to present this pricing clearly and attractively. Mention the savings and any additional offers like credit card discounts.
        Always remind the agent to confirm current offers, as these details are based on information from A4-27.pdf and may be subject to change.
        {{else}}
          {{#if (eq product "ETPrime")}}
          - **Pricing for ETPrime**: "For the most up-to-date and detailed ETPrime pricing, including any special offers, please refer to our official document A4-27.pdf. I will now outline the general value and benefits, and your sales agent can provide the precise current subscription options based on this document."
          {{/if}}
        {{/if}}
    - **Pricing for TOI+**:
        {{#if (eq product "TOI+")}}
        - "For the most current TOI+ subscription plans and offers, please refer to our official document A4-26.pdf. I will now outline the general value and benefits, and your sales agent can provide the precise current subscription options based on this document."
        {{/if}}
    - **General Pricing Note**: If specific pricing details are not available for the selected product/plan, create a placeholder statement instructing the sales agent to provide the current pricing information, mentioning the relevant document (A4-26.pdf for TOI+, A4-27.pdf for ETPrime) if applicable.

5.  A clear and fully articulated call to action, designed to encourage immediate subscription.
6.  An estimated speaking duration for the entire pitch (e.g., "4-5 minutes").

Double-check that all requested sections are present, fully developed, and the pitch concludes naturally without abruptness. The language must be easy for an agent to deliver and for a customer to understand and act upon.
Output the response in JSON format. Ensure the keyBenefits are detailed, the pitchBody is substantial, and the callToAction is complete.
{
  "headlineHook": "[compelling, conversion-focused headline hook]",
  "introduction": "[simple, engaging introduction]",
  "keyBenefits": ["Elaborated benefit 1 (focus on value)...", "Elaborated benefit 2 (focus on value)...", "Elaborated benefit 3 (focus on value)..."],
  "pitchBody": "[Detailed pitch body content, including clear pricing discussion as per instructions above, or explicit instructions for the agent regarding pricing documents A4-26.pdf / A4-27.pdf if specific plan pricing is not applicable...]",
  "callToAction": "[strong, clear call to action encouraging subscription]",
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
    // The prompt now handles pricing logic based on input.etPrimePlanType
    const {output} = await prompt(input);
    return output!;
  }
);

