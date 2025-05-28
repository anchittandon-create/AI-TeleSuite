
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
  headlineHook: z.string().describe('A direct and clear opening statement or question for the pitch.'),
  introduction: z.string().describe('The introduction of the pitch.'),
  keyBenefits: z.array(z.string()).describe('The key benefits of the product, elaborated with examples or brief explanations.'),
  pitchBody: z.string().describe('The main body of the sales pitch, designed to last 2-3 minutes when spoken, including pricing information if available or placeholders.'),
  callToAction: z.string().describe('The call to action of the pitch.'),
  estimatedDuration: z.string().describe('Estimated speaking duration of the entire pitch (e.g., "4-5 minutes").')
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

// Helper type for the processed input to the prompt
const InternalGeneratePitchPromptInputSchema = GeneratePitchInputSchema.extend({
  pricingDetails: z.string().describe("Pre-formatted pricing string or instructions for the agent regarding pricing."),
  productSpecificGuidance: z.string().describe("Additional guidance specific to the product, like key benefits to highlight.")
});
type InternalGeneratePitchPromptInput = z.infer<typeof InternalGeneratePitchPromptInputSchema>;


export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  return generatePitchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: InternalGeneratePitchPromptInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a telesales expert. Your goal is to generate a comprehensive sales pitch script for {{product}} targeted at the {{customerCohort}} customer cohort.
The language MUST be simple, direct, professional, persuasive, and easy for a sales agent to deliver effectively to close a sale. Avoid marketing slogans or overly "salesy" language. Focus on clarity and the value proposition.
The entire pitch MUST be suitable for a 4-5 minute spoken delivery. Ensure ALL sections (opening, introduction, key benefits, pitch body, call to action) are FULLY DEVELOPED and the pitch does NOT end abruptly. The pitch body itself should be substantial.

The pitch must include:
1.  An 'headlineHook': A direct and clear opening statement or question that grabs attention by highlighting immediate value.
2.  An 'introduction': A brief, engaging introduction that smoothly transitions from the opening.
3.  At least 3-4 'keyBenefits', ELABORATED with examples or brief explanations to make them impactful and clear. Do not just list benefits; explain them.
    {{{productSpecificGuidance}}}
4.  A main 'pitchBody' that flows well, is substantial, and expands on the value proposition, designed to last 2-3 minutes when spoken.
    - Seamlessly integrate the following pricing information into the pitch body:
    {{{pricingDetails}}}
    - If multiple plan options are detailed in the pricing information, present them clearly as viable choices, explaining the value of each.
    - Always instruct the agent to confirm current offers with the customer, as pricing and promotions can change.
    - **IMPORTANT**: Do NOT suggest offering a free trial unless explicitly part of the pricing information for a selected plan. Focus on the value of the subscription.
5.  A clear and fully articulated 'callToAction', designed to encourage immediate subscription. Make it compelling and guide the customer on the next step.
6.  An 'estimatedDuration' for the entire pitch (e.g., "4-5 minutes").

Double-check that ALL requested sections are present, FULLY developed, and the pitch concludes NATURALLY without abruptness. The language must be easy for an agent to deliver and for a customer to understand and act upon.
Output the response in JSON format. Ensure the keyBenefits are detailed, the pitchBody is substantial and includes pricing, and the callToAction is complete.
{
  "headlineHook": "[Direct and clear opening statement/question...]",
  "introduction": "[Simple, engaging introduction...]",
  "keyBenefits": ["Elaborated benefit 1 (focus on value based on product guidance)...", "Elaborated benefit 2 (focus on value based on product guidance)...", "Elaborated benefit 3..."],
  "pitchBody": "[Detailed pitch body content, including clear pricing discussion based on '{{{pricingDetails}}}'. Ensure this section is substantial...]",
  "callToAction": "[Strong, clear, fully developed call to action encouraging subscription. Explain how or what next step to take...]",
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
    let productSpecificGuidance = "";
    const offerConfirmationReminder = " As an agent, please always confirm the most current offers and terms with the customer before finalizing the sale, as promotions can change.";

    if (input.product === "ET") {
      productSpecificGuidance = `
When discussing benefits for "ET", focus on the value of an ETPrime subscription. For example, elaborate on:
- Exclusive, in-depth news coverage and investigative reports not found elsewhere.
- Expert opinions, sharp analysis, and actionable insights from industry leaders and ET's renowned journalists.
- A premium, ad-light reading experience for focused consumption of content.
- Access to archives, research tools, and special features like ET Portfolio and Stock Screener.
- E-paper access and other digital conveniences.`;

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
        pricingDetails = `We have several excellent subscription options for ETPrime tailored for you under the "${input.etPlanConfiguration}" configuration:\n${planSpecifics}`;
      } else {
        // ET product selected, but no specific configuration chosen
        pricingDetails = `We have a range of subscription options for The Economic Times. As a sales agent, please present the current plans and best available offers to the customer, including any special discounts and refer to the standard ETPrime benefits.${offerConfirmationReminder}`;
      }
    } else if (input.product === "TOI") {
        productSpecificGuidance = `
When discussing benefits for "TOI", focus on the value of a TOI+ subscription. For example, elaborate on:
- Comprehensive news coverage from India and around the world.
- In-depth articles, opinion pieces, and exclusive interviews.
- An enhanced digital reading experience with features like personalized news feeds and offline reading.
- Access to TOI's archives and special editions.`; // General TOI+ benefits
        pricingDetails = `
We have fantastic options for you to save big on TOI+ and stay informed!
- **1-Year Plan**: You can enjoy TOI+ for just ₹214 per month (billed annually at ₹2565). Plus, get an additional ₹200 discount if you pay with a credit card. That's a 45% saving!
- **2-Year Plan (Special Plan)**: Our 2-Year Special Plan is a great deal at ₹149 per month (billed at ₹3574 for two years). You also get an extra ₹300 discount with credit card payments, saving you 45%!
- **3-Year Plan (Best Value Plan)**: For the absolute best value, choose our 3-Year Plan at only ₹122 per month (billed at ₹4398 for three years). This plan also comes with an additional ₹300 discount on credit card payments, giving you a total of 45% savings!
${offerConfirmationReminder}`;
    } else {
      // Should not happen due to schema validation, but as a fallback:
      pricingDetails = `Please instruct the sales agent to provide the current pricing information for the selected product.${offerConfirmationReminder}`;
    }

    const promptInput: InternalGeneratePitchPromptInput = {
      ...input,
      pricingDetails: pricingDetails,
      productSpecificGuidance: productSpecificGuidance,
    };

    const {output} = await prompt(promptInput);
    if (!output) {
        console.error("Pitch generation flow: Prompt returned null output for input:", input);
        // Fallback for null output
        let errorHeadline = "Pitch Generation Error";
        let errorIntro = "Could not generate introduction for the pitch.";
        let errorBenefits = ["Failed to generate key benefits."];
        let errorBody = "The AI encountered an issue and could not generate the main pitch body. Please try adjusting your selections or try again later.";
        let errorCTA = "Could not generate a call to action.";
        if (input.product) {
            errorHeadline = `Error Generating Pitch for ${input.product}`;
            errorBody = `The AI failed to generate the pitch body for ${input.product}. This might be due to the specific combination of product, cohort, and plan configuration. Please try again or adjust your inputs.`;
        }
        
        return {
            headlineHook: errorHeadline,
            introduction: errorIntro,
            keyBenefits: errorBenefits,
            pitchBody: errorBody,
            callToAction: errorCTA,
            estimatedDuration: "N/A"
        };
    }
    return output;
  }
);

    
