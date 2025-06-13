
'use server';

/**
 * @fileOverview Generates a sales pitch using an AI model, guided by Knowledge Base content and input parameters.
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import type { Product, ETPlanConfiguration, SalesPlan, CustomerCohort } from '@/types';
import { PRODUCTS, ET_PLAN_CONFIGURATIONS, SALES_PLANS, CUSTOMER_COHORTS } from '@/types';


const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.enum(CUSTOMER_COHORTS).describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the primary source of information for the pitch features and benefits.'),
  salesPlan: z.enum(SALES_PLANS).optional().describe("The specific sales plan duration being pitched (e.g., '1-Year', 'Monthly')."),
  offer: z.string().optional().describe("Specific offer details for this pitch (e.g., '20% off', 'TimesPrime bundle included')."),
  agentName: z.string().optional().describe("The name of the sales agent delivering the pitch."),
  userName: z.string().optional().describe("The name of the customer receiving the pitch.")
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;


const GeneratePitchOutputSchema = z.object({
  pitchTitle: z.string().describe("A compelling title for the sales pitch."),
  warmIntroduction: z.string().describe("A brief, friendly opening, introducing the agent (if name provided) and the product brand."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call and possibly hinting at benefits or offers relevant to that cohort."),
  productExplanation: z.string().min(10).describe("Clear explanation of the product ({{{product}}}), focusing on customer benefits derived *ONLY* from the Knowledge Base. If KB is sparse, state what kind of info would be here and refer agent to KB."),
  keyBenefitsAndBundles: z.string().min(10).describe("Highlight 2-4 key benefits and any bundled offers, drawing *ONLY* from the Knowledge Base. Explain added value. If KB is sparse, state what kind of info would be here and refer agent to KB."),
  discountOrDealExplanation: z.string().describe("Explanation of any specific discount or deal ({{{offer}}}, {{{salesPlan}}}). If no offer, mention plan availability. Use <INSERT_PRICE> placeholder. If KB is sparse, state what kind of info would be here and refer agent to KB."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections with brief rebuttals based *ONLY* on Knowledge Base content (e.g., 'Common Selling Themes'). If KB is sparse, state what kind of info would be here and refer agent to KB."),
  finalCallToAction: z.string().describe("A clear and direct call to action, prompting the customer to proceed or request more information."),
  fullPitchScript: z.string().min(50).describe("The complete, integrated sales pitch script (target 450-600 words), combining all above sections smoothly. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, and <INSERT_PRICE>."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the full pitch script (e.g., "3-5 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the agent specific to this pitch, product, and cohort (e.g., 'Emphasize X benefit for this cohort').")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;


const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a GenAI-powered telesales assistant trained to generate high-conversion sales pitches for {{{product}}}.
Your task is to generate a professional, persuasive, 3–5 minute telesales pitch (approximately 450-600 words) that an agent can read aloud.
Adhere strictly to the output schema and guidelines, populating ALL fields in 'GeneratePitchOutputSchema'. Each section must be sufficiently detailed.

User and Pitch Context:
- Product: {{{product}}}
- Customer Cohort: {{{customerCohort}}}
- Sales Plan (if specified): {{{salesPlan}}}
- Offer (if specified): {{{offer}}}
- Agent Name (if specified): {{{agentName}}}
- Customer Name (if specified): {{{userName}}}
{{#if etPlanConfiguration}}
- ET Plan Configuration: {{{etPlanConfiguration}}}
{{/if}}

CRITICAL INSTRUCTION: The 'Knowledge Base Context' below is your *ONLY* source for product features, benefits, and specific details about {{{product}}}.
DO NOT invent or infer any features, benefits, pricing, or details NOT EXPLICITLY stated in the Knowledge Base Context.
If context is limited for a section, briefly state what information would typically go there and suggest the agent refer to the full KB.

Knowledge Base Context:
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Output Generation Rules & Pitch Structure:
You MUST populate EVERY field in the 'GeneratePitchOutputSchema'.
1.  **pitchTitle**: Create a compelling title for this specific pitch (e.g., "Exclusive {{{product}}} Offer for {{{customerCohort}}}").
2.  **warmIntroduction**: Start with a friendly greeting. Introduce the agent (using "{{AGENT_NAME}}" if provided, otherwise "your sales representative") and the brand "{{PRODUCT_NAME}}".
3.  **personalizedHook**: State the purpose of the call. Personalize based on "{{customerCohort}}". Example: If 'Payment Drop-off', emphasize urgency and ease of completion using KB info if available.
4.  **productExplanation**: Concisely explain {{{product}}} using brand-specific benefit language derived *only* from the Knowledge Base Context. Focus on translating KB features into clear customer advantages relevant to "{{customerCohort}}". If KB is sparse, state: "A detailed explanation of {{{product}}}'s core value, derived from the Knowledge Base, would go here. Please consult the KB for specific talking points."
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits* of {{{product}}}, strictly from the Knowledge Base Context. Explain customer gains. If bundles (e.g., TimesPrime) are in KB, explain their *added value* and specific benefits. If KB is sparse, state: "Key benefits and bundle details, sourced from the Knowledge Base, would be listed here. Refer to KB for specifics."
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal. Use "<INSERT_PRICE>" for price. If no plan/offer, mention attractive plans are available. If KB is sparse on offer details, state: "Details of the current discount or deal, as per the Knowledge Base, would be explained here. Check KB for offer specifics."
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, trust) with brief, benefit-oriented rebuttals based *only* on information in Knowledge Base Context (e.g., 'Common Selling Themes' if present). If KB is sparse, state: "Common objections and their KB-derived rebuttals would be previewed here. Consult the KB for approved responses."
8.  **finalCallToAction**: Conclude with a strong call to action (e.g., "Would you like to subscribe now?" or "Shall I send a link for the offer?").
9.  **fullPitchScript**: This is the main output. Comprehensively integrate ALL detailed content from sections 2-8. Ensure a flowing script of 450-600 words. Use placeholders: {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, <INSERT_PRICE>.
10. **estimatedDuration**: Estimate speaking time for 'fullPitchScript' (e.g., "3-5 minutes").
11. **notesForAgent** (Optional): 1-2 brief, actionable notes for the agent specific to this pitch, product, and cohort (e.g., "For 'Paywall Dropoff' cohort, emphasize exclusive content from KB.").

Tone: Conversational, confident, respectful, helpful. Use simple English.
Generate the pitch.
`,
  model: 'googleai/gemini-1.5-flash-latest',
  config: {
    temperature: 0.5,
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }
});

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim().length < 50) {
      const errorTitle = "Pitch Generation Failed - Insufficient Knowledge Base";
      const errorMessage = `The Knowledge Base for '${input.product}' is too sparse or missing. The AI cannot generate a meaningful pitch without sufficient product details. Please update the Knowledge Base.`;
      return {
        pitchTitle: errorTitle,
        warmIntroduction: errorMessage,
        personalizedHook: "(KB content insufficient)",
        productExplanation: "(KB content insufficient)",
        keyBenefitsAndBundles: "(KB content insufficient)",
        discountOrDealExplanation: "(KB content insufficient)",
        objectionHandlingPreviews: "(KB content insufficient)",
        finalCallToAction: "(KB content insufficient)",
        fullPitchScript: `Pitch generation aborted due to insufficient Knowledge Base content for product '${input.product}'. AI requires detailed KB to create a relevant pitch. ${errorMessage}`,
        estimatedDuration: "N/A",
        notesForAgent: "Knowledge Base needs to be populated for this product to enable effective pitch generation."
      };
    }

    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.fullPitchScript || output.fullPitchScript.length < 50) {
         console.error("generatePitchFlow: AI returned no or very short pitch script. Input context (truncated):", JSON.stringify({...input, knowledgeBaseContext: input.knowledgeBaseContext.substring(0,200) + "..."}, null, 2));
        throw new Error("AI failed to generate a complete pitch script. The response from the model was empty or too short.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow (AI call):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error("Input to generatePitchFlow (KB context truncated):", JSON.stringify({...input, knowledgeBaseContext: input.knowledgeBaseContext.substring(0,200) + "..."}, null, 2));
      
      let clientErrorTitle = "Pitch Generation Failed - AI Error";
      let clientErrorMessage = `The AI model encountered an error and could not generate the pitch. Details: ${error.message}.`;

      if (error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("permission denied")) {
        clientErrorTitle = "Pitch Generation Failed - API Key/Permission Issue";
        clientErrorMessage = `There seems to be an issue with the API key or permissions for the AI model ('${generatePitchPrompt.name}'). Please check server logs and ensure the Google API Key is valid and has access to the Gemini models. Original error: ${error.message}`;
      } else if (error.message.toLowerCase().includes("safety settings") || error.message.toLowerCase().includes("blocked")) {
        clientErrorTitle = "Pitch Generation Failed - Content Safety";
        clientErrorMessage = `The pitch generation was blocked, likely due to content safety filters. The combination of your prompt and Knowledge Base content might have triggered this. Original error: ${error.message}`;
      } else if (error.message.toLowerCase().includes("model returned no response") || error.message.toLowerCase().includes("empty or too short")) {
        clientErrorTitle = "Pitch Generation Failed - No AI Response";
        clientErrorMessage = `The AI model did not return a valid response, or the response was empty/too short. This might be due to overly restrictive input or a temporary model issue. Original error: ${error.message}`;
      }

      return {
        pitchTitle: clientErrorTitle,
        warmIntroduction: clientErrorMessage, 
        personalizedHook: "(AI error)",
        productExplanation: "(AI error)",
        keyBenefitsAndBundles: "(AI error)",
        discountOrDealExplanation: "(AI error)",
        objectionHandlingPreviews: "(AI error)",
        finalCallToAction: "(AI error)",
        fullPitchScript: `Pitch generation failed due to an AI service error. Details: ${clientErrorMessage}. Please check server logs. Input context provided to AI may have caused issues.`,
        estimatedDuration: "N/A",
        notesForAgent: "AI service error during pitch generation. Check server logs and KB content quality for the selected product."
      };
    }
  }
);


export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  const parseResult = GeneratePitchInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for generatePitch:", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      pitchTitle: "Pitch Generation Failed - Invalid Input",
      warmIntroduction: `Input validation failed: ${errorMessages.substring(0,250)}`,
      personalizedHook: "(Invalid input)",
      productExplanation: "(Invalid input)",
      keyBenefitsAndBundles: "(Invalid input)",
      discountOrDealExplanation: "(Invalid input)",
      objectionHandlingPreviews: "(Invalid input)",
      finalCallToAction: "(Invalid input)",
      fullPitchScript: `Pitch generation aborted due to invalid input. Details: ${errorMessages}`,
      estimatedDuration: "N/A",
      notesForAgent: "Input validation failed. Check server console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow:", error);
     let clientErrorTitle = "Pitch Generation Error - Critical System Issue";
     let clientErrorMessage = `Pitch generation failed due to a critical system error: ${error.message.substring(0,250)}.`;
      if (error.message && (error.message.includes("GenkitInitError:") || error.message.toLowerCase().includes("api key not found") )) {
        clientErrorTitle = `Pitch Generation Failed: AI Service Initialization Error`;
        clientErrorMessage = `Please verify your GOOGLE_API_KEY in .env and check Google Cloud project settings. (Details: ${error.message})`;
    }
    return {
      pitchTitle: clientErrorTitle,
      warmIntroduction: clientErrorMessage,
      personalizedHook: "(System error)",
      productExplanation: "(System error)",
      keyBenefitsAndBundles: "(System error)",
      discountOrDealExplanation: "(System error)",
      objectionHandlingPreviews: "(System error)",
      finalCallToAction: "(System error)",
      fullPitchScript: `Pitch generation critically failed. Details: ${clientErrorMessage}`,
      estimatedDuration: "N/A",
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}
    

    

      