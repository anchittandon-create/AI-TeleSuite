
'use server';

/**
 * @fileOverview Generates a tailored sales pitch based on the selected product and customer cohort.
 * - generatePitch - A function that generates the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS } from '@/types';

export const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.string().describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'),
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;

export const GeneratePitchOutputSchema = z.object({
  headlineHook: z.string().describe('A direct and clear opening statement or question for the pitch.'),
  introduction: z.string().describe('The introduction of the pitch.'),
  keyBenefits: z.array(z.string()).describe('The key benefits of the product, elaborated with examples or brief explanations.'),
  pitchBody: z.string().describe('The main body of the sales pitch, designed to last 2-3 minutes when spoken, including pricing information if available or placeholders.'),
  callToAction: z.string().describe('The call to action of the pitch.'),
  estimatedDuration: z.string().describe('Estimated speaking duration of the entire pitch (e.g., "4-5 minutes").')
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const InternalGeneratePitchPromptInputSchema = GeneratePitchInputSchema.extend({
  pricingDetails: z.string().describe("Pre-formatted pricing string or instructions for the agent regarding pricing."),
  productSpecificGuidance: z.string().describe("Additional guidance specific to the product, like key benefits to highlight.")
});
type InternalGeneratePitchPromptInput = z.infer<typeof InternalGeneratePitchPromptInputSchema>;

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: InternalGeneratePitchPromptInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are an expert sales scriptwriter. Generate a compelling sales pitch based on the provided information.
Product: {{{product}}}
Customer Cohort: {{{customerCohort}}}
{{#if etPlanConfiguration}}ET Plan Configuration: {{{etPlanConfiguration}}}{{/if}}
Pricing Details: {{{pricingDetails}}}
Specific Guidance: {{{productSpecificGuidance}}}

Craft a pitch that includes:
1.  Headline Hook: A captivating opening.
2.  Introduction: Briefly introduce the product and its relevance.
3.  Key Benefits: Highlight 2-3 key benefits.
4.  Pitch Body: Elaborate on the product, weaving in benefits, use cases, and addressing potential needs of the cohort. Include pricing.
5.  Call to Action: A clear next step for the customer.
6.  Estimated Duration: Estimate the speaking time.

Ensure the tone is persuasive and professional.
`,
  model: 'googleai/gemini-2.0-flash'
});

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    let pricingDetails = "Pricing varies, please confirm current offers.";
    let productSpecificGuidance = "Focus on value and relevance to the customer.";

    if (input.product === "ET") {
      pricingDetails = "ET offers various plans like 1-Year, 3-Year, and 7-Year. Mention current discounts for credit card payments.";
      productSpecificGuidance = "Highlight ETPrime's exclusive content, ad-light experience, and credibility. For ET, a '1, 2 and 3 year plans' configuration means standard plans are offered. For '1, 3 and 7 year plans', this indicates a focus on longer-term value, adjust pitch accordingly.";
      if (input.etPlanConfiguration) {
          productSpecificGuidance += ` Specifically address the '${input.etPlanConfiguration}' configuration by focusing on those plan durations and their respective benefits.`;
      }
    } else if (input.product === "TOI") {
      pricingDetails = "TOI+ has competitive subscription plans, often with multi-year discounts. Check current offers.";
      productSpecificGuidance = "Emphasize TOI's comprehensive news coverage, personalized experience, and trusted brand.";
    }
    
    const promptInput: InternalGeneratePitchPromptInput = {
      ...input,
      pricingDetails,
      productSpecificGuidance,
    };

    try {
      const {output} = await generatePitchPrompt(promptInput);
      if (!output) {
        console.error("generatePitchFlow: Prompt returned no output.");
        throw new Error("AI failed to generate pitch content.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow:", error);
      // Construct a valid error output conforming to GeneratePitchOutputSchema
      return {
        headlineHook: "Error: Could not generate pitch",
        introduction: `An error occurred: ${error.message}. Please check your API key and network.`,
        keyBenefits: ["AI service unavailable"],
        pitchBody: `Failed to generate pitch body due to: ${error.message}. Ensure Google API Key is set and valid.`,
        callToAction: "Contact support if issue persists.",
        estimatedDuration: "N/A"
      };
    }
  }
);

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  try {
    return await generatePitchFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow:", error);
    return {
      headlineHook: "Critical Error: Pitch Generation Failed",
      introduction: `A server-side error occurred: ${error.message}. Please check server logs.`,
      keyBenefits: ["System error"],
      pitchBody: `The pitch generation service encountered a critical failure: ${error.message}.`,
      callToAction: "Please try again later or contact support.",
      estimatedDuration: "N/A"
    };
  }
}
