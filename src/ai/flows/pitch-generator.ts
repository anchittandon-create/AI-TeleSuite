
'use server';

/**
 * @fileOverview Generates a tailored sales pitch based on the selected product, customer cohort, and Knowledge Base content.
 * - generatePitch - A function that generates the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai}from '@/ai/genkit';
import {z}from 'genkit';
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS, SalesPlan, SALES_PLANS, CustomerCohort, CUSTOMER_COHORTS } from '@/types'; // Added SalesPlan and CUSTOMER_COHORTS

const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.enum(CUSTOMER_COHORTS).describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the primary source of information for the pitch.'),
  salesPlan: z.enum(SALES_PLANS).optional().describe("The specific sales plan duration being pitched (e.g., '1-Year', 'Monthly')."),
  offer: z.string().optional().describe("Specific offer details for this pitch (e.g., '20% off', 'TimesPrime bundle included')."),
  agentName: z.string().optional().describe("The name of the sales agent delivering the pitch."),
  userName: z.string().optional().describe("The name of the customer receiving the pitch.")
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;

const GeneratePitchOutputSchema = z.object({
  pitchTitle: z.string().describe("A compelling title for the sales pitch (e.g., 'Unlock Exclusive Insights with ET Prime – Special Offer for You!')."),
  warmIntroduction: z.string().describe("A brief, friendly opening to start the conversation (e.g., 'Hi {{USER_NAME}}, this is {{AGENT_NAME}} calling from {{PRODUCT_NAME}}...')."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call (e.g., 'I see you recently explored our plans...' or 'We have a special offer for our valued former subscribers like you...'). This should clearly reference the {{USER_COHORT}}."),
  productExplanation: z.string().describe("A concise explanation of the product ({{PRODUCT_NAME}}), focusing on its core value proposition and how it solves the customer's potential needs based on their cohort. This section must translate features from the Knowledge Base into clear *customer benefits*."),
  keyBenefitsAndBundles: z.string().describe("A section highlighting 2-4 key *benefits* of the product, directly tied to features mentioned in the Knowledge Base. If bundles (like TimesPrime, Docubay) are relevant and mentioned in the KB, explain their *added value and benefits* to the customer here. Focus on what the customer gains."),
  discountOrDealExplanation: z.string().describe("Explain any special discount, pricing for the {{PLAN_NAME}}, or bundled offer ({{OFFER_DETAILS}}). Use the placeholder `<INSERT_PRICE>` where actual pricing needs to be inserted by the agent. Clearly state the value proposition of the offer."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections (e.g., related to cost, trust, or hesitation) with brief, benefit-oriented rebuttals based on information from the Knowledge Base."),
  finalCallToAction: z.string().describe("A clear call to action, encouraging the customer to subscribe or take the next step. Create a sense of urgency or provide reassurance if appropriate."),
  fullPitchScript: z.string().describe("The complete, integrated sales pitch script, approximately 450-600 words, formatted for easy reading and delivery. This script should weave together all the above sections seamlessly. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, and <INSERT_PRICE> where appropriate."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the full pitch script (e.g., "4-5 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the sales agent delivering the pitch (e.g., 'Emphasize ad-free experience for Paywall Dropoff cohort', 'Highlight value of Big Bull Portfolio for investors').")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are an expert telesales pitch scriptwriter, specifically trained for premium Indian media subscriptions: ET Prime and TOI Plus. Your task is to generate a complete, natural-sounding, and highly persuasive sales pitch script approximately 450-600 words long (estimated 4-5 minute delivery).

CRITICAL INSTRUCTION: The 'Knowledge Base Context' provided below is your *ONLY* source of truth for product features, benefits, and specific details about {{product}}. You MUST NOT invent, assume, or infer any features, benefits, pricing, or details that are not EXPLICITLY stated in the 'Knowledge Base Context'. If the context is limited for a certain aspect, your pitch must also be limited for that aspect, or you should state that the agent needs to refer to the full internal KB for more details.
Prioritize explaining customer *benefits* derived from features rather than just listing features.

User and Pitch Context:
- Product to Pitch: {{{product}}}
- Customer Cohort: {{{customerCohort}}}
- Sales Plan (if specified): {{{salesPlan}}}
- Specific Offer (if specified): {{{offer}}}
- Agent's Name (if specified): {{{agentName}}}
- Customer's Name (if specified): {{{userName}}}
{{#if etPlanConfiguration}}
- ET Plan Configuration to consider: {{{etPlanConfiguration}}}
{{/if}}

Knowledge Base Context (Your Sole Source for Product Details):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Your Task and Pitch Structure:
Generate a complete pitch by populating all fields in the 'GeneratePitchOutputSchema'. The 'fullPitchScript' should be a cohesive narrative integrating all sections.

1.  **pitchTitle**: Create a compelling title for this specific pitch.
2.  **warmIntroduction**: A brief, friendly opening. Use "{{AGENT_NAME}}" and "{{USER_NAME}}" if provided, otherwise use generic placeholders like "your agent" or "valued customer".
3.  **personalizedHook**: Tailor this hook based on the "{{customerCohort}}". Explain the reason for the call in a way that resonates with their specific situation (e.g., for "Payment Dropoff", acknowledge their previous interest).
4.  **productExplanation**: Concisely explain what {{{product}}} is. CRITICALLY, focus on its core value proposition and how it directly *benefits* the customer based on their "{{customerCohort}}". Translate features found *ONLY* in the Knowledge Base Context into clear, compelling *customer advantages*.
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits*. These MUST be derived from the Knowledge Base Context. Explain what the customer *gains* from these features. If bundles (e.g., TimesPrime, Docubay) are mentioned in the KB, explain their *added value and specific benefits* to the customer.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the value of this specific offer. If no plan/offer is specified, briefly mention that attractive plans are available.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, "I don't have time") with brief, benefit-oriented rebuttals. These rebuttals must be based on information *found only* in the Knowledge Base Context (e.g., value for money, productivity boost themes if present in KB).
8.  **finalCallToAction**: A clear, confident call to action. Encourage subscription or the next step.
9.  **fullPitchScript**: This is the main output. Combine all the above sections into a single, flowing script of 450-600 words. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}} (for {{{product}}}), {{USER_COHORT}} (for {{{customerCohort}}}), {{PLAN_NAME}} (for {{{salesPlan}}}), {{OFFER_DETAILS}} (for {{{offer}}}), and <INSERT_PRICE> where appropriate. The script should sound natural, be broken into manageable paragraphs, and be easy for a telesales agent to deliver.
10. **estimatedDuration**: Estimate the speaking time for the 'fullPitchScript' (e.g., "4-5 minutes").
11. **notesForAgent** (Optional): Provide 1-2 brief, actionable notes for the agent delivering this specific pitch, based on the product and cohort (e.g., "For 'Free Trial Expired' cohort, strongly emphasize the ad-free benefit and exclusive content they'll miss.").

General Guidelines:
- Tone: Friendly, confident, professional, and highly conversion-focused.
- Language: Simple English. Hinglish elements can be subtly incorporated if they sound natural for a telesales context in India, but prioritize clarity.
- Placeholders: Ensure all dynamic placeholders mentioned above are used correctly in the 'fullPitchScript'.
- Strict KB Adherence: If the Knowledge Base Context is empty or insufficient for a specific part of the pitch (e.g., no bundle information), explicitly state that the information is not available in the provided KB (e.g., "Details about current bundle offers can be confirmed by your agent.") within the relevant section and the full script. Do NOT invent information.

Generate the pitch.
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
    const placeholderOutput = (message: string, titleMessage: string, notes?: string): GeneratePitchOutput => ({
      pitchTitle: titleMessage,
      warmIntroduction: message,
      personalizedHook: "N/A",
      productExplanation: "N/A",
      keyBenefitsAndBundles: "N/A",
      discountOrDealExplanation: "N/A",
      objectionHandlingPreviews: "N/A",
      finalCallToAction: "Action: Review Knowledge Base and input parameters.",
      fullPitchScript: `${titleMessage}. ${message}. Please check input parameters and ensure comprehensive Knowledge Base content exists for '${input.product}'.`,
      estimatedDuration: "N/A",
      notesForAgent: notes || "Ensure KB is populated for effective pitch generation."
    });

    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      return placeholderOutput(
        "Cannot Generate Pitch: No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base.",
        "Pitch Generation Aborted - Missing Knowledge Base"
      );
    }
    
    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.fullPitchScript || output.fullPitchScript.trim().length < 50) { 
        console.error("generatePitchFlow: Prompt returned minimal or no output for fullPitchScript. Output was:", output);
         return placeholderOutput(
          `AI failed to generate a complete pitch script. The response was too short or incomplete. This might be due to insufficient context in the Knowledge Base for '${input.product}' to construct a full pitch for the cohort '${input.customerCohort}'.`,
          "Pitch Generation Failed - Incomplete AI Response"
        );
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow (calling generatePitchPrompt):", error);
      return placeholderOutput(
        `An error occurred while generating the pitch: ${error.message}. Ensure relevant content is in the Knowledge Base for '${input.product}' and that your API key is valid and correctly configured.`,
        "Pitch Generation Error - AI Service Failure",
        `AI Service Error: ${error.message.substring(0,100)}... Check KB for product '${input.product}'.`
      );
    }
  }
);

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  try {
    return await generatePitchFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow:", error);
    let specificMessage = `A server-side error occurred: ${error.message}.`;
    // Standardize error titles to be caught by PitchCard UI
    let errorTitle = "Pitch Generation Failed - Critical System Error"; 
    let notes = "System error during pitch generation. Review server logs and API Key configuration.";
    let callToAction = "Please try again later. If the issue persists, check your API key settings or contact support.";

    if (error.message && error.message.startsWith("GenkitInitError:")) {
      // Standardize error title for GenkitInitError
      errorTitle = "Pitch Generation Error - AI Service Initialization"; 
      specificMessage = "The AI service could not be initialized. This is often due to a missing or invalid GOOGLE_API_KEY in your .env file, or issues with your Google Cloud project setup (e.g., AI APIs not enabled, billing not configured).";
      notes = "AI Service Initialization Failed. Please verify your GOOGLE_API_KEY in .env and check Google Cloud project settings. See server console logs for details from 'src/ai/genkit.ts'.";
      callToAction = "Please check your API key setup and server logs, then try again. Contact support if the issue persists."
    }

    return {
      pitchTitle: errorTitle,
      warmIntroduction: specificMessage,
      personalizedHook: `Please review server logs. ${error.message.includes("GenkitInitError") ? "Ensure API key is correctly configured." : "Check Knowledge Base content for the selected product."}`,
      productExplanation: "N/A - AI service error.",
      keyBenefitsAndBundles: "N/A - AI service error.",
      discountOrDealExplanation: "N/A - AI service error.",
      objectionHandlingPreviews: "N/A - AI service error.",
      finalCallToAction: callToAction,
      fullPitchScript: `Pitch generation failed due to a system error. ${specificMessage}. Please review the error message in the introduction section and the notes for agent.`,
      estimatedDuration: "N/A",
      notesForAgent: notes
    };
  }
}

