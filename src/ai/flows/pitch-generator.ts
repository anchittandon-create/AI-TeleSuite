
'use server';

/**
 * @fileOverview Generates a tailored sales pitch based on the selected product, customer cohort, and Knowledge Base content.
 * - generatePitch - A function that generates the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai}from '@/ai/genkit';
import {z}from 'genkit';
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS, SalesPlan, SALES_PLANS, CustomerCohort, CUSTOMER_COHORTS } from '@/types';

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
    *   If 'Plan Page Drop-off': Clarify plan details (using "{{PLAN_NAME}}" for {{{salesPlan}}} and "{{OFFER_DETAILS}}" for {{{offer}}} if available) and highlight specific benefits from the Knowledge Base.
    *   If 'Paywall Drop-off': Focus on the content quality and long-term value from the Knowledge Base.
    *   If 'Assisted Buying': Be direct, goal-oriented, and mention agent assistance.
    *   If 'Renewal Drop-off' or 'Expired Users': Reinforce continued value, highlight upgrades or special deals for returning users from the Knowledge Base.
    *   For other cohorts, adapt the hook logically based on the cohort's meaning and information from the Knowledge Base.
4.  **productExplanation**: Concisely explain what {{{product}}} is. Use brand-specific benefit language derived *only* from the Knowledge Base Context:
    *   For ET Prime: Mention (if in KB) deep market analysis, expert investment research, ad-free reading, exclusive reports, trusted by India’s top business readers.
    *   For TOI Plus: Mention (if in KB) premium editorial journalism, ad-free access, early content access, in-depth coverage, trusted voice of India.
    *   CRITICALLY, focus on translating features found *ONLY* in the Knowledge Base Context into clear, compelling *customer advantages and benefits* relevant to the "{{customerCohort}}".
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits* of {{{product}}}. These MUST be derived from the Knowledge Base Context. Explain what the customer *gains* from these features. If bundles (e.g., TimesPrime, Docubay) are mentioned in the KB, explain their *added value and specific benefits* to the customer.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal confidently but mention it no more than twice. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the value of this specific offer. If no plan/offer is specified, briefly mention that attractive plans are available.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, trust, hesitation) with brief, benefit-oriented rebuttals. These rebuttals must be based on information *found only* in the Knowledge Base Context (e.g., using 'Common Selling Themes' like Value for Money, Productivity Boost if present in KB).
8.  **finalCallToAction**: Conclude with a strong call to action, such as: "Would you like me to help you complete the subscription now?" or "Shall I send you a link to activate the offer before it expires?"
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
    temperature: 0.3,
  }
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
      finalCallToAction: "Action: Review Knowledge Base and input parameters. Check server logs for API Key or Genkit initialization issues, or AI service errors.",
      fullPitchScript: `${titleMessage}. ${message}. Please check input parameters and ensure comprehensive Knowledge Base content exists for '${input.product}'. Also, verify Genkit/API Key setup or for specific AI service errors in server logs.`,
      estimatedDuration: "N/A",
      notesForAgent: notes || "Ensure KB is populated for effective pitch generation. Check server logs for Genkit/API Key errors or AI service errors."
    });

    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      return placeholderOutput(
        "Cannot Generate Pitch: No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base.",
        "Pitch Generation Aborted - Missing Knowledge Base"
      );
    }
    
    try {
      const {output} = await generatePitchPrompt(input);

      if (!output) { 
        console.error("Error in generatePitchFlow (generatePitchPrompt call): AI prompt returned completely empty output (null or undefined). Input was:", JSON.stringify(input, null, 2));
        return placeholderOutput(
          `The AI service returned an empty response. This could be a temporary issue with the AI model or a problem with the request configuration. Please try again. If the problem persists, check server logs for details about the AI call.`,
          "Pitch Generation Failed - Empty AI Response"
        );
      }

      // Stricter check for general sparseness or placeholder content in key sections
      const isGenerallySparse = (
        (!output.warmIntroduction || output.warmIntroduction.trim().length < 10 || output.warmIntroduction.toLowerCase().includes("n/a")) ||
        (!output.personalizedHook || output.personalizedHook.trim().length < 10 || output.personalizedHook.toLowerCase().includes("n/a")) ||
        (!output.productExplanation || output.productExplanation.trim().length < 10 || output.productExplanation.toLowerCase().includes("n/a")) ||
        (!output.keyBenefitsAndBundles || output.keyBenefitsAndBundles.trim().length < 10 || output.keyBenefitsAndBundles.toLowerCase().includes("n/a")) ||
        (!output.finalCallToAction || output.finalCallToAction.trim().length < 10 || output.finalCallToAction.toLowerCase().includes("n/a"))
      );

      if (!output.fullPitchScript || output.fullPitchScript.trim().length < 50 || isGenerallySparse) { 
        console.warn("Warning in generatePitchFlow (generatePitchPrompt call): Prompt returned minimal or incomplete output. This may indicate insufficient Knowledge Base content or an AI structuring issue. Full AI Output was:", JSON.stringify(output, null, 2), "Input was:", JSON.stringify(input, null, 2));
        
        let descriptionMessage = `AI failed to generate a complete pitch. `;
        if (isGenerallySparse && (!output.fullPitchScript || output.fullPitchScript.trim().length < 50)) {
            descriptionMessage += `The main script and other key sections appear to be underdeveloped, missing, or contain placeholder 'N/A' values. `;
        } else if (isGenerallySparse) {
            descriptionMessage += `Some key sections of the pitch appear to be underdeveloped, missing, or contain placeholder 'N/A' values, even if a script was attempted. `;
        } else {
             descriptionMessage += `The main script was too short or missing. `;
        }
        descriptionMessage += `This might be due to insufficient context in the Knowledge Base for '${input.product}' to construct a full pitch for the cohort '${input.customerCohort}', or the AI may have had difficulty structuring the full response based on the current inputs. Please ensure the KB is detailed. Check server logs for any specific AI service errors.`;
        
         return placeholderOutput(
          descriptionMessage,
          "Pitch Generation Failed - Incomplete AI Response"
        );
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow (calling generatePitchPrompt):", JSON.stringify(error, Object.getOwnPropertyNames(error)), "Input was:", JSON.stringify(input, null, 2));
      
      const isLikelyInitError = error.message &&
                                (error.message.includes("GenkitInitError:") ||
                                 error.message.toLowerCase().includes("api key not found") ||
                                 (error.message.toLowerCase().includes("api_key") && (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("missing")))
                                );

      if (isLikelyInitError) {
        return placeholderOutput(
          `Pitch Generation Aborted: AI Service Initialization or Configuration Error. Message: ${error.message}. Please verify your GOOGLE_API_KEY in .env, ensure it's valid, and that the Generative Language API is enabled in your Google Cloud project with billing active. See server console logs for detailed Genkit errors from 'src/ai/genkit.ts' and for this specific error.`,
          "Pitch Generation Error - AI Service Configuration",
          `AI Service Config Error. Details: ${error.message.substring(0,100)}...`
        );
      }
      return placeholderOutput(
        `An error occurred while the AI was generating the pitch: ${error.message}. This might be due to the content of the Knowledge Base, the complexity of the request, or a temporary issue with the AI model. Please check the server logs for more details. Ensure relevant content is in the Knowledge Base for '${input.product}'.`,
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
    console.error("Catastrophic error calling generatePitchFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    let specificMessage = `A server-side error occurred: ${error.message}.`;
    let errorTitle = "Pitch Generation Failed - Critical System Error"; 
    let notes = "System error during pitch generation. Review server logs and API Key configuration.";
    let callToAction = "Please try again later. If the issue persists, check your API key settings or contact support.";

    const isLikelyInitError = error.message &&
                              (error.message.includes("GenkitInitError:") ||
                               error.message.toLowerCase().includes("api key not found") ||
                               (error.message.toLowerCase().includes("api_key") && (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("missing")))
                               );

    if (isLikelyInitError) {
      errorTitle = "Pitch Generation Error - AI Service Configuration"; 
      specificMessage = `The AI service could not be correctly configured or accessed. This is often due to a missing or invalid GOOGLE_API_KEY in your .env file, or issues with your Google Cloud project setup (e.g., AI APIs not enabled, billing not configured). Details: ${error.message}`;
      notes = "AI Service Configuration Failed. Please verify your GOOGLE_API_KEY in .env, check Google Cloud project settings, and see server console logs for details (especially from 'src/ai/genkit.ts' and the error above).";
      callToAction = "Please check your API key setup and server logs, then try again. Contact support if the issue persists."
    } else {
      // For non-init errors caught at this very high level
      errorTitle = "Pitch Generation Failed - Critical System Error";
      specificMessage = `A critical server-side error occurred: ${error.message}. This could be an unexpected problem with the AI service or the application logic. Please review server console logs for details.`;
      notes = `Critical system error. Details: ${error.message.substring(0,100)}... Review server logs.`;
    }


    return {
      pitchTitle: errorTitle,
      warmIntroduction: specificMessage,
      personalizedHook: `Please review server logs. ${isLikelyInitError ? "Ensure API key is correctly configured." : "Check Knowledge Base content for the selected product or for other AI service errors."}`,
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
