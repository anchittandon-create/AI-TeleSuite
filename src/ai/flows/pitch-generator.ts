
'use server';

/**
 * @fileOverview Generates a sales pitch using AI, based on the selected product, customer cohort, and Knowledge Base content.
 * - generatePitch - A function that handles the AI-driven sales pitch generation.
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
  productExplanation: z.string().describe("A concise explanation of the product ({{PRODUCT_NAME}}), focusing on its core value proposition and how it solves the customer's potential needs based on their cohort. This section must translate features from the Knowledge Base into clear *customer benefits*."),
  keyBenefitsAndBundles: z.string().describe("A section highlighting 2-4 key *benefits* of the product, directly tied to features mentioned in the Knowledge Base. If bundles (like TimesPrime, Docubay) are relevant and mentioned in the KB, explain their *added value and benefits* to the customer here. Focus on what the customer gains."),
  discountOrDealExplanation: z.string().describe("Explain any special discount, pricing for the {{PLAN_NAME}}, or bundled offer ({{OFFER_DETAILS}}). Use the placeholder `<INSERT_PRICE>` where actual pricing needs to be inserted by the agent. Clearly state the value proposition of the offer."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections (e.g., related to cost, trust, or hesitation) with brief, benefit-oriented rebuttals based on information from the Knowledge Base."),
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
2.  **warmIntroduction**: Start with a friendly greeting. Introduce the agent (using "{{agentName}}" if provided, otherwise "your agent") and the brand ("{{{product}}}"). If '{{{userName}}}' is provided, use it.
3.  **personalizedHook**: Mention the purpose of the call clearly. Personalize this hook based on the "{{customerCohort}}":
    *   If 'Payment Dropoff': Emphasize offer urgency and ease of completion.
    *   If 'Plan Page Dropoff': Clarify plan details (using "{{salesPlan}}" for plan name and "{{offer}}" for offer details if available) and highlight specific benefits from the Knowledge Base.
    *   If 'Paywall Dropoff': Focus on the content quality and long-term value from the Knowledge Base.
    *   If 'Assisted Buying': Be direct, goal-oriented, and mention agent assistance.
    *   If 'Renewal Drop-off' or 'Expired Users': Reinforce continued value, highlight upgrades or special deals for returning users from the Knowledge Base.
    *   For other cohorts, adapt the hook logically based on the cohort's meaning and information from the Knowledge Base.
4.  **productExplanation**: Concisely explain what {{{product}}} is. Use brand-specific benefit language derived *only* from the Knowledge Base Context:
    *   For ET Prime: Mention (if in KB) deep market analysis, expert investment research, ad-free reading, exclusive reports, trusted by India’s top business readers.
    *   For TOI Plus: Mention (if in KB) premium editorial journalism, ad-free access, early content access, in-depth coverage, trusted voice of India.
    *   CRITICALLY, focus on translating features found *ONLY* in the Knowledge Base Context into clear, compelling *customer advantages and benefits* relevant to the "{{customerCohort}}".
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits* of {{{product}}}. These MUST be derived from the Knowledge Base Context. Explain what the customer *gains* from these features. If bundles (e.g., TimesPrime, Docubay) are mentioned in the KB, explain their *added value and specific benefits* to the customer.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal confidently. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the value of this specific offer. If no plan/offer is specified, briefly mention that attractive plans are available and the agent can provide details.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, trust, hesitation) with brief, benefit-oriented rebuttals. These rebuttals must be based on information *found only* in the Knowledge Base Context (e.g., using 'Common Selling Themes' like Value for Money, Productivity Boost if present in KB).
8.  **finalCallToAction**: Conclude with a strong call to action, such as: "Would you like me to help you complete the subscription now?" or "Shall I send you a link to activate the offer before it expires?"
9.  **fullPitchScript**: This is the main output. Ensure this script comprehensively and smoothly integrates *all* the detailed content generated for the individual sections above. Combine all sections into a single, flowing script of 450-600 words. Use placeholders like {{AGENT_NAME}} (for {{{agentName}}}), {{USER_NAME}} (for {{{userName}}}), {{PRODUCT_NAME}} (for {{{product}}}), {{USER_COHORT}} (for {{{customerCohort}}}), {{PLAN_NAME}} (for {{{salesPlan}}}), {{OFFER_DETAILS}} (for {{{offer}}}), and <INSERT_PRICE> where appropriate. The script should sound natural, be broken into manageable paragraphs, and be easy for a telesales agent to deliver.
10. **estimatedDuration**: Estimate the speaking time for the 'fullPitchScript' (e.g., "3-5 minutes").
11. **notesForAgent** (Optional): Provide 1-2 brief, actionable notes for the agent delivering this specific pitch, based on the product and cohort (e.g., "For 'Paywall Dropoff' cohort, strongly emphasize the exclusive content benefit.").

Tone Guidelines:
- Conversational, confident, respectful of the user’s time.
- Avoid robotic repetition or sales clichés.
- Be helpful, not pushy.
- Use simple English. Subtle Hinglish elements are acceptable if they sound natural for a telesales context in India, but prioritize clarity.

Generate the pitch. Ensure all fields in the output schema are populated.
`,
  model: 'googleai/gemini-2.0-flash',
  config: {
    temperature: 0.5,
  }
});

const placeholderOutput: GeneratePitchOutput = {
  pitchTitle: "Pitch Generation Failed",
  warmIntroduction: "Could not generate pitch. AI service may be unavailable or an error occurred.",
  personalizedHook: "Please check server logs for more details.",
  productExplanation: "Ensure your GOOGLE_API_KEY is correctly set in the .env file and that the Gemini API is enabled in your Google Cloud project with billing active.",
  keyBenefitsAndBundles: "Also, verify that the Knowledge Base contains relevant content for the selected product.",
  discountOrDealExplanation: "If the problem persists, it might be a temporary issue with the AI service or a quota limit.",
  objectionHandlingPreviews: "",
  finalCallToAction: "Action: Review configuration and Knowledge Base.",
  fullPitchScript: "Pitch Generation Aborted. See individual sections for potential reasons.",
  estimatedDuration: "N/A",
  notesForAgent: "Check server logs for detailed error messages from the AI service."
};


const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      return {
        ...placeholderOutput,
        pitchTitle: "Pitch Generation Failed - Missing Knowledge Base",
        warmIntroduction: "Cannot Generate Pitch: No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base for '" + input.product + "'.",
        productExplanation: "Pitch generation requires sufficient information about the product from the Knowledge Base.",
        fullPitchScript: "Pitch Generation Aborted: Missing essential Knowledge Base content. Please update the Knowledge Base for " + input.product + ".",
        notesForAgent: "Ensure Knowledge Base is populated for effective pitch generation. This pitch could not be generated due to missing KB data."
      };
    }

    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.fullPitchScript || output.fullPitchScript.trim().length < 50) {
        // This indicates the AI returned a very short or empty response
        console.error("generatePitchFlow: AI returned a sparse or empty response. This might indicate issues with the prompt understanding or model capacity. Input was:", JSON.stringify(input, null, 2).substring(0, 500) + "...");
        return {
            ...placeholderOutput,
            pitchTitle: "Pitch Generation Failed - AI Response Too Short",
            warmIntroduction: "The AI model generated an unusually short or empty pitch. This could be due to highly restrictive Knowledge Base content or an internal AI model issue.",
            fullPitchScript: "AI Response Incomplete. The generated pitch script was too short to be usable. Please try adjusting Knowledge Base content or try again later.",
            notesForAgent: "AI returned an incomplete response. Review KB or check model status."
        };
      }
      return output;
    } catch (err) {
      const error = err as Error & {cause?: any, details?: any};
      console.error("Error in generatePitchFlow (AI call):", error);
      console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      if (error.cause) console.error("Error cause:", error.cause);
      if (error.details) console.error("Error details:", error.details);

      let specificMessage = placeholderOutput.warmIntroduction; // Default fallback
      const isLikelyInitError = (
        error.message?.toLowerCase().includes("api key") ||
        error.message?.toLowerCase().includes("genkit") ||
        error.message?.toLowerCase().includes("permission denied") ||
        error.message?.toLowerCase().includes("quota") ||
        error.message?.toLowerCase().includes("authentication")
      );

      if (isLikelyInitError) {
        console.error("[Pitch Generator Specific Log] Classified as 'LikelyInitError'. Error Message:", error.message);
        specificMessage = `Pitch Generation Aborted: AI Service Initialization or Configuration Error. ${error.message}. Please verify your GOOGLE_API_KEY, Google Cloud project settings (Gemini API enabled, billing active), and check for quota issues. (Details from server logs)`;
      } else if (error.message?.toLowerCase().includes("model")) {
         specificMessage = `Pitch Generation Failed: AI Model Error. ${error.message}. The AI model may be temporarily unavailable or encountered an issue processing the request.`;
      } else {
        specificMessage = `Pitch Generation Error: ${error.message || "An unexpected error occurred with the AI service."}`;
      }
      
      return {
        ...placeholderOutput,
        pitchTitle: "Pitch Generation Error - System Issue",
        warmIntroduction: specificMessage,
        fullPitchScript: `Pitch generation failed due to a system error. Details: ${error.message || 'Unknown error'}`,
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
    console.error("Catastrophic error calling generatePitchFlow from export function:", error);
     let specificMessage = `Pitch Generation Failed due to a critical server-side error: ${error.message}.`;
     if (error.message?.toLowerCase().includes("api key")) {
        specificMessage = `Critical Failure: AI Service Initialization Error. Please verify your GOOGLE_API_KEY in .env and check Google Cloud project settings. (Details: ${error.message})`;
    }
    return {
      ...placeholderOutput,
      pitchTitle: "Pitch Generation Error - Critical System Issue",
      warmIntroduction: specificMessage,
      fullPitchScript: `Pitch generation critically failed. Details: ${error.message}`,
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}
