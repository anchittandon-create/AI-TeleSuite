
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
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS } from '@/types'; // Updated import

const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.string().describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'), // Updated field
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
  pricingDetails: z.string().describe("Pre-formatted pricing string or placeholder for the agent.")
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

5.  A clear and fully articulated call to action, designed to encourage immediate subscription. Make it compelling.
6.  An estimated speaking duration for the entire pitch (e.g., "4-5 minutes").

Double-check that ALL requested sections are present, FULLY developed, and the pitch concludes NATURALLY without abruptness. The language must be easy for an agent to deliver and for a customer to understand and act upon.
Output the response in JSON format. Ensure the keyBenefits are detailed, the pitchBody is substantial, and the callToAction is complete.
{
  "headlineHook": "[compelling, conversion-focused headline hook]",
  "introduction": "[simple, engaging introduction]",
  "keyBenefits": ["Elaborated benefit 1 (focus on value)...", "Elaborated benefit 2 (focus on value)...", "Elaborated benefit 3 (focus on value)..."],
  "pitchBody": "[Detailed pitch body content, including clear pricing discussion as per instructions above, or explicit instructions for the agent regarding pricing documents A4-27.pdf / A4-26.pdf if specific plan pricing is not applicable... Ensure this section is substantial and not just a few sentences.]",
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

    if (input.product === "ET") {
      if (input.etPlanConfiguration) {
        let planSpecifics = "";
        const reminder = " Always remind the agent to confirm current offers, as these details are based on information from A4-27.pdf and may be subject to change.";

        if (input.etPlanConfiguration === "1, 3 and 7 year plans") {
          planSpecifics = `
- **1-Year Plan**: Get exclusive insights from The Economic Times for just ₹214 per month (billed as ₹2565 for the year). Extra ₹150 discount with credit card. Save 45%!${reminder}
- **3-Year Plan**: For greater savings, our 3-year plan is effectively ₹153 per month (total ₹5497 for three years). Extra ₹400 discount with credit card. Save 45%!${reminder}
- **7-Year Plan**: The best value! The 7-year plan is just ₹108 per month (total ₹9163 for seven years). Extra ₹500 off with credit card. Save 45%!${reminder}`;
        } else if (input.etPlanConfiguration === "1, 2 and 3 year plans") {
          planSpecifics = `
- **1-Year Plan**: Get exclusive insights from The Economic Times for just ₹214 per month (billed as ₹2565 for the year). Extra ₹150 discount with credit card. Save 45%!${reminder}
- **2-Year Plan**: We also have a 2-year option. Please ask your sales agent for the current pricing and offers for this plan, as these details can be found in document A4-27.pdf and may vary.${reminder}
- **3-Year Plan**: Our 3-year plan is effectively ₹153 per month (total ₹5497 for three years). Extra ₹400 discount with credit card. Save 45%!${reminder}`;
        }
        pricingDetails = `- **Pricing for ET (${input.etPlanConfiguration})**: We have several excellent subscription options for you:${planSpecifics}`;
      } else {
        // ET product selected, but no specific configuration chosen
        pricingDetails = `- **Pricing for ET**: "For the most up-to-date and detailed ET pricing, including any special offers, please refer to our official document A4-27.pdf. Your sales agent can provide the precise current subscription options based on this document."`;
      }
    } else if (input.product === "TOI") {
      pricingDetails = `- **Pricing for TOI**: "For the most current TOI subscription plans and offers, please refer to our official document A4-26.pdf. Your sales agent can provide the precise current subscription options based on this document."`;
    } else {
      pricingDetails = `- **Pricing Information**: "Please instruct the sales agent to provide the current pricing information. For TOI, refer to A4-26.pdf. For ET, refer to A4-27.pdf."`;
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
