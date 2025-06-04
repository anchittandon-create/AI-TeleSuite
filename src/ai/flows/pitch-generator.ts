
'use server';

/**
 * @fileOverview Generates a tailored sales pitch based on the selected product and customer cohort.
 * Genkit has been removed. This flow will return placeholder error messages.
 * - generatePitch - A function that generates the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

// import {ai} from '@/ai/genkit'; // Genkit removed
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
// const InternalGeneratePitchPromptInputSchema = GeneratePitchInputSchema.extend({
//   pricingDetails: z.string().describe("Pre-formatted pricing string or instructions for the agent regarding pricing."),
//   productSpecificGuidance: z.string().describe("Additional guidance specific to the product, like key benefits to highlight.")
// });
// type InternalGeneratePitchPromptInput = z.infer<typeof InternalGeneratePitchPromptInputSchema>;

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  console.warn("AI Pitch Generator: Genkit has been removed. Returning placeholder error response.");
  try {
    // Simulate basic input validation or processing if needed
    GeneratePitchInputSchema.parse(input);

    return Promise.resolve({
      headlineHook: "AI Feature Disabled",
      introduction: "Pitch generation is currently unavailable as the AI service (Genkit) has been removed.",
      keyBenefits: ["Core AI functionality removed."],
      pitchBody: "The AI-powered pitch generation feature is not active. Please contact support or check configuration if you believe this is an error.",
      callToAction: "Feature disabled.",
      estimatedDuration: "N/A"
    });
  } catch (e) {
    const error = e as Error;
    console.error("Error in disabled generatePitch function (likely input validation):", error);
    return Promise.resolve({
      headlineHook: "Input Error or AI Feature Disabled",
      introduction: `Could not process request: ${error.message}. AI service (Genkit) has been removed.`,
      keyBenefits: ["Error processing request."],
      pitchBody: "The AI-powered pitch generation feature is not active.",
      callToAction: "Error.",
      estimatedDuration: "N/A"
    });
  }
}

// const prompt = ai.definePrompt({ // Genkit removed
//   name: 'generatePitchPrompt',
//   input: {schema: InternalGeneratePitchPromptInputSchema},
//   output: {schema: GeneratePitchOutputSchema},
//   prompt: `...` // Prompt removed for brevity as Genkit is disabled
// });

// const generatePitchFlow = ai.defineFlow( // Genkit removed
//   {
//     name: 'generatePitchFlow',
//     inputSchema: GeneratePitchInputSchema,
//     outputSchema: GeneratePitchOutputSchema,
//   },
//   async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
//     // ... original logic commented out ...
//     // const {output} = await prompt(promptInput);
//     // return output!; 
//     // This part is now handled by the modified exported function.
//     throw new Error("generatePitchFlow called but Genkit is removed.");
//   }
// );
