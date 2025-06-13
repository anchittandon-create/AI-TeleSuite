
'use server';

/**
 * @fileOverview Generates a sales pitch using AI, guided by Knowledge Base content and input parameters.
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS, SalesPlan, SALES_PLANS, CustomerCohort, CUSTOMER_COHORTS } from '@/types';


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
  pitchTitle: z.string().describe("A compelling title for the sales pitch (e.g., 'Unlock Exclusive Insights with ET Prime – Special Offer for You!')."),
  warmIntroduction: z.string().describe("A brief, friendly opening to start the conversation (e.g., 'Hi {{USER_NAME}}, this is {{AGENT_NAME}} calling from {{PRODUCT_NAME}}...')."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call (e.g., 'I see you recently explored our plans...' or 'We have a special offer for our valued former subscribers like you...'). This should clearly reference the {{USER_COHORT}}."),
  productExplanation: z.string().describe("Explain {{{PRODUCT_NAME}}}. From the 'Knowledge Base Context', extract its core value proposition. Identify key features relevant to the {{{USER_COHORT}}} and translate these into 2-3 compelling *customer benefits*. Clearly explain these benefits."),
  keyBenefitsAndBundles: z.string().describe("From the 'Knowledge Base Context', identify and list 2-4 distinct key product features. For each feature, explicitly state the *customer benefit* it provides. If the KB mentions bundled offers (e.g., TimesPrime, Docubay), describe these bundles and highlight their specific added value and benefits to the customer."),
  discountOrDealExplanation: z.string().describe("Explain any special discount, pricing for the {{PLAN_NAME}}, or bundled offer ({{OFFER_DETAILS}}). Use the placeholder `<INSERT_PRICE>` where actual pricing needs to be inserted by the agent. Clearly state the value proposition of the offer."),
  objectionHandlingPreviews: z.string().describe("Based *only* on information available in the 'Knowledge Base Context' (especially any 'Common Selling Themes' or direct product strengths), identify 1-2 potential customer objections related to {{{PRODUCT_NAME}}} and formulate brief, benefit-oriented preview rebuttals for them. If the KB lacks information for this, state 'Refer to full KB for objection handling.'"),
  finalCallToAction: z.string().describe("A clear call to action, encouraging the customer to subscribe or take the next step. Create a sense of urgency or provide reassurance if appropriate."),
  fullPitchScript: z.string().describe("The complete, integrated sales pitch script, approximately 450-600 words, formatted for easy reading and delivery. This script should weave together all the above sections seamlessly. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, and <INSERT_PRICE> where appropriate."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the full pitch script (e.g., "3-5 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the sales agent delivering the pitch (e.g., 'Emphasize ad-free experience for Paywall Dropoff cohort', 'Highlight value of Big Bull Portfolio for investors').")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a GenAI-powered telesales assistant trained to generate high-conversion sales pitches for two premium Indian media subscriptions: {{product}}.
Your task is to generate a professional, persuasive, 3–5 minute telesales pitch (approximately 450-600 words) that an agent can read aloud to a prospective subscriber.
Adhere strictly to the following structure and guidelines, populating all fields in the 'GeneratePitchOutputSchema'. Ensure each section (Warm Introduction through Final Call to Action) is sufficiently detailed and contributes effectively to the overall target length of the 'fullPitchScript'. The quality and completeness of each individual section are paramount.

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

CRITICAL INSTRUCTION: The 'Knowledge Base Context' provided below is your *ONLY* source of truth for product features, benefits, and specific details about {{{product}}}. You MUST NOT invent, assume, or infer any features, benefits, pricing, or details that are not EXPLICITLY stated in the 'Knowledge Base Context'. If the context is limited for a certain aspect, your pitch must also be limited for that aspect. Prioritize explaining customer *benefits* derived from features rather than just listing features.

Knowledge Base Context (Your Sole Source for Product Details):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Pitch Structure and Content Guidelines:
1.  **pitchTitle**: Create a compelling title for this specific pitch.
2.  **warmIntroduction**: Start with a friendly greeting. Introduce the agent (using "{{AGENT_NAME}}" if provided, otherwise "your agent") and the brand ("{{PRODUCT_NAME}}").
3.  **personalizedHook**: Mention the purpose of the call clearly. Personalize this hook based on the "{{customerCohort}}":
    *   If 'Payment Drop-off': Emphasize offer urgency and ease of completion.
    *   If 'Plan Page Dropoff': Clarify plan details (using "{{PLAN_NAME}}" for {{{salesPlan}}} and "{{OFFER_DETAILS}}" for {{{offer}}} if available) and highlight specific benefits from the Knowledge Base.
    *   If 'Paywall Dropoff': Focus on the content quality and long-term value from the Knowledge Base.
    *   If 'Assisted Buying': Be direct, goal-oriented, and mention agent assistance.
    *   If 'Renewal Drop-off' or 'Expired Users': Reinforce continued value, highlight upgrades or special deals for returning users from the Knowledge Base.
    *   For other cohorts, adapt the hook logically based on the cohort's meaning and information from the Knowledge Base.
4.  **productExplanation**: Explain {{{product}}}. From the 'Knowledge Base Context', extract its core value proposition. Identify key features relevant to the {{{USER_COHORT}}} and translate these into 2-3 compelling *customer benefits*. Clearly explain these benefits.
    *   CRITICALLY, focus on translating features found *ONLY* in the Knowledge Base Context into clear, compelling *customer advantages and benefits* relevant to the "{{customerCohort}}".
5.  **keyBenefitsAndBundles**: From the 'Knowledge Base Context', identify and list 2-4 distinct key product features. For each feature, explicitly state the *customer benefit* it provides. If the KB mentions bundled offers (e.g., TimesPrime, Docubay), describe these bundles and highlight their specific added value and benefits to the customer.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal confidently but mention it no more than twice. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the value of this specific offer. If no plan/offer is specified, briefly mention that attractive plans are available.
7.  **objectionHandlingPreviews**: Based *only* on information available in the 'Knowledge Base Context' (especially any 'Common Selling Themes' or direct product strengths), identify 1-2 potential customer objections related to {{{PRODUCT_NAME}}} and formulate brief, benefit-oriented preview rebuttals for them. If the KB lacks information for this, state 'Refer to full KB for objection handling.'
8.  **finalCallToAction**: Conclude with a strong call to action, such as: "Would you like me to complete the subscription now?" or "Shall I send you a link to activate the offer before it expires?"
9.  **fullPitchScript**: This is the main output. Ensure this script comprehensively and smoothly integrates *all* the detailed content generated for the individual sections above. Combine all sections into a single, flowing script of 450-600 words. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}} (for {{{product}}}), {{USER_COHORT}} (for {{{customerCohort}}}), {{PLAN_NAME}} (for {{{salesPlan}}}), {{OFFER_DETAILS}} (for {{{offer}}}), and <INSERT_PRICE> where appropriate. The script should sound natural, be broken into manageable paragraphs, and be easy for a telesales agent to deliver.
10. **estimatedDuration**: Estimate the speaking time for the 'fullPitchScript' (e.g., "3-5 minutes").
11. **notesForAgent** (Optional): Provide 1-2 brief, actionable notes for the agent delivering this specific pitch, based on the product and cohort (e.g., "For 'Paywall Dropoff' cohort, strongly emphasize the exclusive content benefit.").

Tone Guidelines:
- Conversational, confident, respectful of the user’s time.
- Avoid robotic repetition or sales clichés.
- Be helpful, not pushy.
- Use simple English. Subtle Hinglish elements are acceptable if they sound natural for a telesales context in India, but prioritize clarity.

Generate the pitch.
`,
  model: 'googleai/gemini-2.0-flash',
  config: {
    temperature: 0.5, 
  }
});


const placeholderOutput: GeneratePitchOutput = {
  pitchTitle: "Pitch Generation Failed - System Error",
  warmIntroduction: "Could not generate pitch. A system error occurred or AI service is unavailable. Check quotas, API Key, and project settings.",
  personalizedHook: "Please ensure Knowledge Base has relevant information for the selected product, and AI service is operational.",
  productExplanation: "The system requires operational AI and/or Knowledge Base content to explain the product.",
  keyBenefitsAndBundles: "Key benefits and bundles are derived using AI and Knowledge Base.",
  discountOrDealExplanation: "Offer details will be populated here by AI based on your input and KB.",
  objectionHandlingPreviews: "Common objections and their previews are generated by AI using KB content.",
  finalCallToAction: "A call to action will be formulated here by AI.",
  fullPitchScript: "Pitch Generation Aborted. Check Knowledge Base, system logs, and ensure the AI service (e.g., Google Gemini) is correctly configured with a valid API key and no quota issues.",
  estimatedDuration: "N/A",
  notesForAgent: "Review Knowledge Base for the selected product and try again. Verify AI service status and configuration."
};

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      console.warn("generatePitchFlow: No KB context provided or KB is empty for product:", input.product);
      return {
        ...placeholderOutput,
        pitchTitle: `Pitch Generation Aborted - Missing Knowledge Base for ${input.product}`,
        warmIntroduction: `Cannot Generate Pitch: No relevant knowledge base content was found for ${input.product}. Please add information to the Knowledge Base. The AI needs this context.`,
        productExplanation: `Pitch generation requires sufficient information about ${input.product} from the Knowledge Base for the AI to process.`,
        fullPitchScript: `Pitch Generation Aborted: Missing essential Knowledge Base content for ${input.product}. Please update the Knowledge Base. The AI cannot generate a meaningful pitch without it.`,
        notesForAgent: `Ensure Knowledge Base is populated for ${input.product}. This pitch could not be generated due to missing KB data needed by the AI.`
      };
    }

    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.pitchTitle || output.pitchTitle.trim().length < 5 || !output.fullPitchScript || output.fullPitchScript.length < 100) {
        console.error("generatePitchFlow: AI returned no, null, or very sparse output. Input was:", JSON.stringify(input, null, 2));
        return {
          ...placeholderOutput,
          pitchTitle: "Pitch Generation Failed - AI Returned Sparse Content",
          warmIntroduction: "The AI model generated an incomplete or empty pitch. This might be due to very limited Knowledge Base context, a temporary AI service issue, or an overly restrictive prompt.",
          fullPitchScript: "AI-generated pitch script was too short or empty. Please check Knowledge Base context for sufficient detail and try again. If the issue persists, the AI model might be having trouble with this specific request.",
          notesForAgent: "AI response was insufficient. Ensure KB has rich details for the product and cohort. Check server logs for AI errors."
        };
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow (AI call):", error);
      
      // Check if error message suggests API key, auth, or quota issues
      const errorMsgLower = error.message.toLowerCase();
      const isLikelyInitError = 
        errorMsgLower.includes("api key") || 
        errorMsgLower.includes("auth") || 
        errorMsgLower.includes("permission denied") ||
        errorMsgLower.includes("quota") ||
        errorMsgLower.includes("billing") ||
        errorMsgLower.includes("genkitiniterror");

      if (isLikelyInitError) {
        console.error(`[Pitch Generator Specific Log] Classified as 'LikelyInitError'. Error Message: "${error.message}"`);
        return {
          ...placeholderOutput,
          pitchTitle: "Pitch Generation Failed - AI Service Configuration Issue",
          warmIntroduction: `AI Service Error: ${error.message}. Please check your GOOGLE_API_KEY, Google Cloud project settings (ensure Gemini API is enabled), billing, and quotas.`,
          fullPitchScript: `Pitch Generation Aborted due to AI Service Error: ${error.message}. More details in server logs. This often points to API key, permissions, or quota problems.`,
          notesForAgent: "Verify AI service configuration (API key, project, billing, quotas). Check server logs for exact error from Google AI."
        };
      }

      return {
        ...placeholderOutput,
        pitchTitle: "Pitch Generation Failed - Unexpected AI Error",
        warmIntroduction: `An unexpected error occurred while communicating with the AI service: ${error.message}`,
        fullPitchScript: `Pitch Generation Aborted due to an unexpected AI service error: ${error.message}. Check server logs for more details.`,
        notesForAgent: "An unexpected AI error occurred. Review server logs."
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
      ...placeholderOutput,
      pitchTitle: "Pitch Generation Failed - Invalid Input",
      warmIntroduction: `There was an issue with the input provided: ${errorMessages}`,
      fullPitchScript: `Pitch generation aborted due to invalid input. Details: ${errorMessages}`,
      notesForAgent: "Input validation failed. Check console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow from exported function:", error);
    return {
      ...placeholderOutput,
      pitchTitle: "Pitch Generation Error - System Issue",
      warmIntroduction: `Pitch generation failed due to a critical system error: ${error.message}.`,
      fullPitchScript: `Pitch generation failed. Details: ${error.message}`,
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}
