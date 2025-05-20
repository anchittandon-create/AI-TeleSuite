
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
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS } from '@/types';

const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.string().describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'),
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

// Helper type for the processed input to the prompt
const InternalGeneratePitchPromptInputSchema = GeneratePitchInputSchema.extend({
  pricingDetails: z.string().describe("Pre-formatted pricing string or instructions for the agent regarding pricing.")
});
type InternalGeneratePitchPromptInput = z.infer<typeof InternalGeneratePitchPromptInputSchema>;


export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  return generatePitchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: InternalGeneratePitchPromptInputSchema}, // Uses the internal schema
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a telesales expert. Your goal is to generate a comprehensive sales pitch script for {{product}} targeted at the {{customerCohort}} customer cohort.
The language MUST be simple, direct, persuasive, and easy for a sales agent to deliver effectively to close a sale. It should be highly conversion-focused.
The entire pitch MUST be suitable for a 4-5 minute spoken delivery. Ensure ALL sections (headline, introduction, key benefits, pitch body, call to action) are FULLY DEVELOPED and the pitch does NOT end abruptly. The pitch body itself should be substantial.

The pitch must include:
1.  A compelling headline hook.
2.  A brief, engaging introduction.
3.  At least 3-4 key benefits, ELABORATED with examples or brief explanations to make them impactful and clear. Do not just list benefits; explain them.
4.  A main pitch body that flows well, is substantial, and expands on the value proposition, designed to last 2-3 minutes when spoken.
    {{{pricingDetails}}}
    - **IMPORTANT**: Do NOT suggest offering a free trial unless explicitly part of the pricing information for a selected plan. Focus on the value of the subscription.
    - If multiple plan options are detailed in the pricing information, present them clearly to the customer as viable choices.
    - Always instruct the agent to confirm current offers with the customer, as pricing and promotions can change.

5.  A clear and fully articulated call to action, designed to encourage immediate subscription. Make it compelling.
6.  An estimated speaking duration for the entire pitch (e.g., "4-5 minutes").

Double-check that ALL requested sections are present, FULLY developed, and the pitch concludes NATURALLY without abruptness. The language must be easy for an agent to deliver and for a customer to understand and act upon.
Output the response in JSON format. Ensure the keyBenefits are detailed, the pitchBody is substantial, and the callToAction is complete.
{
  "headlineHook": "[compelling, conversion-focused headline hook]",
  "introduction": "[simple, engaging introduction]",
  "keyBenefits": ["Elaborated benefit 1 (focus on value)...", "Elaborated benefit 2 (focus on value)...", "Elaborated benefit 3 (focus on value)..."],
  "pitchBody": "[Detailed pitch body content, including clear pricing discussion as per instructions above, or explicit instructions for the agent regarding pricing if specific plan pricing is not applicable... Ensure this section is substantial and not just a few sentences.]",
  "callToAction": "[Strong, clear, fully developed call to action encouraging subscription. Do not just say 'Subscribe now'. Explain how or what next step to take.]",
  "estimatedDuration": "4-5 minutes"
}`,
});

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    let pricingDetails = "";
    const offerConfirmationReminder = " As an agent, please always confirm the most current offers and terms with the customer before finalizing the sale, as promotions can change.";

    if (input.product === "ET") {
      if (input.etPlanConfiguration) {
        let planSpecifics = "";
        if (input.etPlanConfiguration === "1, 3 and 7 year plans") {
          planSpecifics = `
- **1-Year Plan**: Get exclusive insights from The Economic Times for just ₹214 per month (billed as ₹2565 for the year). Plus, there's an extra ₹150 discount if you use a credit card. This is a 45% saving!${offerConfirmationReminder}
- **3-Year Plan**: For even greater savings, our 3-year plan effectively costs ₹153 per month (totaling ₹5497 for three years). And you get an additional ₹400 discount with credit card payments! That's a 45% saving.${offerConfirmationReminder}
- **7-Year Plan**: Our best value! The 7-year plan works out to just ₹108 per month (totaling ₹9163 for seven years). Plus, there's a ₹500 additional discount on credit cards! You save 45% with this option too.${offerConfirmationReminder}`;
        } else if (input.etPlanConfiguration === "1, 2 and 3 year plans") {
          planSpecifics = `
- **1-Year Plan**: Get exclusive insights from The Economic Times for just ₹214 per month (billed as ₹2565 for the year). Plus, there's an extra ₹150 discount if you use a credit card. This is a 45% saving!${offerConfirmationReminder}
- **2-Year Plan**: We also have an attractive 2-year option. As a sales agent, please provide the customer with the current pricing and specific offers for this 2-year plan, as these may vary.${offerConfirmationReminder}
- **3-Year Plan**: Our 3-year plan effectively costs ₹153 per month (totaling ₹5497 for three years). And you get an additional ₹400 discount with credit card payments! That's a 45% saving.${offerConfirmationReminder}`;
        }
        pricingDetails = `- **Pricing for ET (${input.etPlanConfiguration})**: We have several excellent subscription options for you:${planSpecifics}`;
      } else {
        // ET product selected, but no specific configuration chosen
        pricingDetails = `- **Pricing for ET**: "We have a range of subscription options for The Economic Times. As a sales agent, please present the current plans and best available offers to the customer, including any special discounts."${offerConfirmationReminder}`;
      }
    } else if (input.product === "TOI") {
        pricingDetails = `
- **Pricing for TOI+**: We have fantastic options for you to save big on TOI+ and stay informed!
  - **1-Year Plan**: You can enjoy TOI+ for just ₹214 per month (billed annually at ₹2565). Plus, get an additional ₹200 discount if you pay with a credit card. That's a 45% saving!
  - **2-Year Plan (Special Plan)**: Our 2-Year Special Plan is a great deal at ₹149 per month (billed at ₹3574 for two years). You also get an extra ₹300 discount with credit card payments, saving you 45%!
  - **3-Year Plan (Best Value Plan)**: For the absolute best value, choose our 3-Year Plan at only ₹122 per month (billed at ₹4398 for three years). This plan also comes with an additional ₹300 discount on credit card payments, giving you a total of 45% savings!
  ${offerConfirmationReminder}`;
    } else {
      // Should not happen due to schema validation, but as a fallback:
      pricingDetails = `- **Pricing Information**: "Please instruct the sales agent to provide the current pricing information for the selected product."${offerConfirmationReminder}`;
    }

    const promptInput: InternalGeneratePitchPromptInput = {
      ...input,
      pricingDetails: pricingDetails,
    };

    const {output} = await prompt(promptInput);
    if (!output) {
        console.error("Pitch generation flow: Prompt returned null output for input:", input);
        return {
            headlineHook: "Error: Could not generate headline.",
            introduction: "Error: Could not generate introduction.",
            keyBenefits: ["Error: Could not generate key benefits."],
            pitchBody: "Error: AI failed to generate the pitch body. Please check the inputs or try again. The AI model might have encountered an issue.",
            callToAction: "Error: Could not generate call to action.",
            estimatedDuration: "N/A"
        };
    }
    return output;
  }
);

