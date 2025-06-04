
'use server';

/**
 * @fileOverview Generates a tailored sales pitch based on the selected product, customer cohort, and Knowledge Base content.
 * - generatePitch - A function that generates the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai}from '@/ai/genkit';
import {z}from 'genkit';
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS } from '@/types';

const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.string().describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the primary source of information for the pitch.')
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;

const GeneratePitchOutputSchema = z.object({
  headlineHook: z.string().describe('A direct and clear opening statement or question for the pitch.'),
  introduction: z.string().describe('The introduction of the pitch.'),
  keyBenefits: z.array(z.string()).describe('The key benefits of the product, elaborated with examples or brief explanations, sourced ONLY from the Knowledge Base.'),
  pitchBody: z.string().describe('The main body of the sales pitch, designed to last 4-5 minutes when spoken, including pricing information if available in the KB or placeholders if not.'),
  callToAction: z.string().describe('The call to action of the pitch.'),
  estimatedDuration: z.string().describe('Estimated speaking duration of the entire pitch (e.g., "4-5 minutes").')
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are an expert sales scriptwriter. Your task is to generate a compelling sales pitch.

CRITICAL INSTRUCTION: The 'Knowledge Base Context' below is your *ONLY* source of truth for {{{product}}}. You MUST NOT invent, assume, or infer any features, benefits, pricing, or details that are not EXPLICITLY stated in the 'Knowledge Base Context'. If the context is limited, your pitch must also be limited. Do not add any information from your general knowledge or other sources.

Product to focus on: {{{product}}}
Customer Cohort to target: {{{customerCohort}}}
{{#if etPlanConfiguration}}ET Plan Configuration to consider: {{{etPlanConfiguration}}}{{/if}}

Knowledge Base Context:
{{{knowledgeBaseContext}}}

Using *ONLY* the 'Knowledge Base Context', craft a pitch that includes:
1.  Headline Hook: A captivating opening derived *ONLY* from the KB.
2.  Introduction: Briefly introduce the product and its relevance using information *ONLY* from the Knowledge Base.
3.  Key Benefits: Identify and list 2-3 key benefits of the product or its subscription tiers. Crucially, these benefits MUST be explicitly stated, or directly and narrowly inferable, *ONLY* from the text and information found within the 'Knowledge Base Context' provided above. Do not invent benefits or pull them from any other source.
4.  Pitch Body: Elaborate on the product, weaving in benefits, use cases, and addressing potential needs of the cohort, using details *ONLY* from the Knowledge Base. This section should be substantial enough to contribute significantly to a 4-5 minute total pitch duration. If pricing details are present in the Knowledge Base, include them. If not, state that current pricing/offers should be confirmed by the agent and are not in the KB.
5.  Call to Action: A clear next step for the customer, consistent with information *ONLY* if mentioned in the Knowledge Base.
6.  Estimated Duration: Estimate the speaking time for the complete pitch, aiming for 4-5 minutes.

Ensure the tone is persuasive and professional. If the Knowledge Base Context is empty or insufficient for any section, explicitly state that the information is not available in the provided Knowledge Base (e.g., "Pricing information not found in provided Knowledge Base." or "Specific call to action not found in Knowledge Base."). Do not invent or infer information not present in the context. Adhere strictly to the Knowledge Base content.
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
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      return {
        headlineHook: "Cannot Generate Pitch",
        introduction: "No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base.",
        keyBenefits: ["N/A due to missing KB content"],
        pitchBody: "Unable to generate pitch body due to missing knowledge base information for this product. Please check Knowledge Base.",
        callToAction: "Action: Update Knowledge Base for this product to enable pitch generation.",
        estimatedDuration: "N/A"
      };
    }
    
    try {
      const {output} = await generatePitchPrompt(input);
      if (!output) {
        console.error("generatePitchFlow: Prompt returned no output.");
        throw new Error("AI failed to generate pitch content.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow:", error);
      return {
        headlineHook: "Error: Could not generate pitch",
        introduction: `An error occurred: ${error.message}. Ensure relevant content is in the Knowledge Base.`,
        keyBenefits: ["AI service unavailable or KB content insufficient"],
        pitchBody: `Failed to generate pitch body due to: ${error.message}. Check API key, network, and ensure comprehensive KB content exists for '${input.product}'.`,
        callToAction: "Contact support if issue persists, or review Knowledge Base.",
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
      introduction: `A server-side error occurred: ${error.message}. Please check server logs and Knowledge Base content.`,
      keyBenefits: ["System error"],
      pitchBody: `The pitch generation service encountered a critical failure: ${error.message}.`,
      callToAction: "Please try again later or contact support.",
      estimatedDuration: "N/A"
    };
  }
}
