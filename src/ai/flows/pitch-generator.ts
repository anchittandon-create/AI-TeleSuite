
'use server';

/**
 * @fileOverview Generates a sales pitch using GenAI, guided by Knowledge Base content and input parameters.
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
  warmIntroduction: z.string().describe("A brief, friendly opening to start the conversation (e.g., 'Hi {{USER_NAME}}, this is {{AGENT_NAME}} calling from {{PRODUCT_NAME}}...'). This should be concise and welcoming."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call (e.g., 'I see you recently explored our plans...' or 'We have a special offer for our valued former subscribers like you...'). This should clearly reference the {{USER_COHORT}} and use information from the Knowledge Base if relevant to the cohort's situation."),
  productExplanation: z.string().min(50).describe("A clear and concise explanation of {{{PRODUCT_NAME}}}, highlighting its core value proposition. This explanation MUST be derived *primarily* from the 'Knowledge Base Context'. Translate features from the KB into tangible customer benefits. Minimum 50 characters."),
  keyBenefitsAndBundles: z.string().min(50).describe("Detail 2-4 key benefits of {{{PRODUCT_NAME}}} and explain any bundled offers (like TimesPrime, Docubay), focusing on their value to the customer. All benefits and bundle details MUST be sourced from the 'Knowledge Base Context'. Minimum 50 characters."),
  discountOrDealExplanation: z.string().describe("Explain any special discount, pricing for the {{PLAN_NAME}}, or bundled offer ({{OFFER_DETAILS}}). Use the placeholder '<INSERT_PRICE>' for the actual price. Articulate the value of the offer. If no specific offer is provided, mention attractive plans are available."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections (e.g., price, need) with brief, benefit-oriented rebuttals. These rebuttals MUST be derived from the 'Common Selling Themes' or product strengths mentioned in the 'Knowledge Base Context'."),
  finalCallToAction: z.string().describe("A clear, concise call to action, encouraging the customer to subscribe or take the next step (e.g., 'Can I help you subscribe now?', 'Shall I send you the offer link?')."),
  fullPitchScript: z.string().min(300).describe("The complete, integrated sales pitch script, formatted for easy reading and delivery, approximately 400-600 words. This script MUST seamlessly weave together all the above sections. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, and <INSERT_PRICE> where appropriate. Ensure natural flow and persuasive language. Minimum 300 characters."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the full pitch script (e.g., "3-5 minutes", "2-3 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the sales agent delivering this specific pitch (e.g., 'Emphasize ad-free experience for Paywall Dropoff cohort', 'Highlight the limited-time nature of the offer if applicable').")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a GenAI-powered telesales assistant, an expert in crafting high-conversion sales pitches for Indian media subscriptions: ET Prime ({{{product}}}) and TOI Plus ({{{product}}}).
Your primary goal is to generate a professional, persuasive, and comprehensive telesales pitch script based on the provided context.
The pitch should be structured to be read aloud by an agent and should aim for an approximate duration of 3-5 minutes (around 400-600 words for the 'fullPitchScript').

User and Pitch Context:
- Product to Pitch: {{{product}}}
- Customer Cohort: {{{customerCohort}}}
{{#if salesPlan}}- Sales Plan (if specified): {{{salesPlan}}}{{/if}}
{{#if offer}}- Specific Offer (if specified): {{{offer}}}{{/if}}
{{#if agentName}}- Agent's Name (if specified): {{{agentName}}}{{/if}}
{{#if userName}}- Customer's Name (if specified): {{{userName}}}{{/if}}
{{#if etPlanConfiguration}}- ET Plan Configuration to consider (if product is ET): {{{etPlanConfiguration}}}{{/if}}

CRITICAL INSTRUCTION: The 'Knowledge Base Context' provided below is your *ONLY* source of truth for product features, benefits, specific details, common selling themes, and any bundled offers (like TimesPrime or Docubay) related to {{{product}}}. You MUST NOT invent, assume, or infer any features, benefits, pricing, or details that are not EXPLICITLY stated in the 'Knowledge Base Context'. If the context is limited for a certain aspect, your pitch's detail for that aspect must also reflect this limitation. Your main task is to skillfully weave information *from the Knowledge Base Context* into each section of the pitch.

Knowledge Base Context for '{{{product}}}':
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Pitch Structure and Content Guidelines (Populate ALL fields in 'GeneratePitchOutputSchema'):

1.  **pitchTitle**: Create a compelling and concise title for this specific sales pitch.

2.  **warmIntroduction**: A brief, friendly opening. Introduce the agent (use "{{AGENT_NAME}}" if provided, otherwise just the brand) and the brand ("{{{product}}}"). Example: "Hi {{USER_NAME}}, this is {{AGENT_NAME}} calling from {{{product}}}. How are you today?"

3.  **personalizedHook**: Clearly state the reason for the call. Personalize this hook based on the "{{customerCohort}}".
    *   Leverage information from the 'Knowledge Base Context' if it contains details relevant to specific cohorts or general user behaviors.
    *   Examples:
        *   Payment Dropoff: "I'm reaching out from {{{product}}} as I see you were very close to joining us recently. We have a special offer to help you complete that easily today."
        *   Plan Page Dropoff: "I noticed you were exploring our {{{product}}} plans. I wanted to highlight some key benefits you might find valuable and share an exclusive offer."
        *   Paywall Dropoff: "You recently showed interest in {{{product}}}'s premium content. I'd love to explain the unique value our subscribers enjoy and a special offer we have for you."
        *   Adapt logically for other cohorts, using the KB for supporting points.

4.  **productExplanation**: Concisely (but with sufficient detail, min 50 chars) explain what {{{product}}} is and its core value proposition. This section MUST be built using information *directly extracted and synthesized from the 'Knowledge Base Context'*. Focus on the *customer benefits* derived from the features mentioned in the KB.
    *   Example from KB: If KB says "ET Prime offers deep market analysis", explain: "With {{{product}}}, you get access to in-depth market analysis, which means you can make more informed investment decisions and stay ahead of trends."

5.  **keyBenefitsAndBundles**: Highlight 2-4 distinct key benefits of {{{product}}} and explain any bundled offers (e.g., TimesPrime, Docubay) if mentioned in the 'Knowledge Base Context'. Explain the *added value* and *specific advantages* these bundles provide to the customer. All points here MUST be sourced from the 'Knowledge Base Context'. (Min 50 chars for this section).

6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal confidently. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the *value* of this specific offer. If no plan/offer is specified, briefly state that attractive plans are available.

7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, already have news, not enough time) with brief, benefit-oriented rebuttals. These rebuttals MUST be based on information and 'Common Selling Themes' *found only* in the 'Knowledge Base Context'.
    *   Example: If KB has "Value for Money" theme, and objection is price: "I understand value is important. Many find that with {{{product}}}, the exclusive insights (mention a specific one from KB if possible) save them time and effort, making it a worthwhile investment."

8.  **finalCallToAction**: Conclude with a clear and polite call to action. Encourage the customer to subscribe or take the next step. Examples: "Would you like me to help you get started with your {{{product}}} subscription now?" or "Shall I send you a link to activate this special offer?"

9.  **fullPitchScript**: This is the main output. Ensure this script (min 300 characters, target 400-600 words) comprehensively and smoothly integrates *all* the detailed content generated for the individual sections above. Combine all sections into a single, flowing script. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}} (for {{{product}}}), {{USER_COHORT}} (for {{{customerCohort}}}), {{PLAN_NAME}} (for {{{salesPlan}}}), {{OFFER_DETAILS}} (for {{{offer}}}), and <INSERT_PRICE> where appropriate. The script should sound natural, be broken into manageable paragraphs, and be easy for a telesales agent to deliver.

10. **estimatedDuration**: Estimate the speaking time for the 'fullPitchScript' (e.g., "3-5 minutes", "2-4 minutes").

11. **notesForAgent** (Optional): Provide 1-2 brief, actionable notes for the agent delivering this specific pitch, based on the product, cohort, or specific KB insights. (e.g., "For 'Paywall Dropoff' cohort, strongly emphasize the exclusive content benefit from the KB.", "If customer mentions X, refer to Y point from KB.").

Tone Guidelines:
- Conversational, confident, empathetic, and respectful.
- Focus on value and benefits for the customer.
- Use clear, simple English. Subtle Hinglish elements are acceptable if they sound natural in an Indian telesales context, but prioritize universal understanding.

Ensure all fields of the 'GeneratePitchOutputSchema' are populated with high-quality, relevant content derived from the provided context.
`,
  model: 'googleai/gemini-2.0-flash',
  config: {
    temperature: 0.5, // Moderate temperature for a balance of creativity and factual grounding
  }
});

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input : GeneratePitchInput) : Promise<GeneratePitchOutput> => {
    const placeholderOutput: GeneratePitchOutput = {
        pitchTitle: "Pitch Generation Failed - Configuration Issue",
        warmIntroduction: "Could not generate pitch. Ensure Knowledge Base has relevant information for the selected product.",
        personalizedHook: "Please ensure Knowledge Base has relevant information for the selected product and cohort.",
        productExplanation: "Pitch generation requires sufficient information about the product from the Knowledge Base.",
        keyBenefitsAndBundles: "Refer to Knowledge Base for key benefits and bundle details.",
        discountOrDealExplanation: "Refer to Knowledge Base or provide offer details for this section.",
        objectionHandlingPreviews: "Refer to Knowledge Base for common objections and their rebuttals.",
        finalCallToAction: "Formulate a call to action based on the offer and conversation.",
        fullPitchScript: "Pitch Generation Aborted. Check Knowledge Base for the selected product. AI generation requires sufficient KB context.",
        estimatedDuration: "N/A",
        notesForAgent: "Review Knowledge Base for the selected product and try again. Ensure API Key is valid and AI model is accessible."
    };

    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim().length < 50) { // Stricter check for KB content
      console.warn("generatePitchFlow (AI): KB context is missing or too short for product:", input.product);
      return {
        ...placeholderOutput,
        pitchTitle: `Pitch Generation Failed - Insufficient Knowledge Base for ${input.product}`,
        warmIntroduction: `Cannot Generate Full Pitch: The Knowledge Base content provided for ${input.product} is insufficient. Please add detailed information to the Knowledge Base.`,
        fullPitchScript: `Pitch Generation Aborted: Insufficient Knowledge Base content for ${input.product}. The AI needs more details to craft a meaningful pitch. Please update the Knowledge Base.`,
        notesForAgent: `Ensure the Knowledge Base for ${input.product} is populated with comprehensive details. AI pitch generation relies heavily on this content.`
      };
    }

    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.fullPitchScript || output.fullPitchScript.length < 100) { // Check for a reasonably complete pitch
        console.error("generatePitchFlow (AI): Prompt returned no or very short pitch. Input was:", JSON.stringify(input, null, 2));
        return {
            ...placeholderOutput,
            pitchTitle: `Pitch Generation Incomplete - AI Response Issue for ${input.product}`,
            warmIntroduction: "The AI model did not return a complete pitch. This might be due to very limited KB context despite initial checks, or an issue with the AI service.",
            fullPitchScript: "AI failed to generate a complete pitch script. Please verify Knowledge Base content and try again. If the issue persists, check server logs for AI service errors.",
            notesForAgent: "AI response was incomplete. Check KB context for sufficient detail and ensure AI service is operational."
        };
      }
      return output;
    } catch (err) {
      const error = err as Error & {cause?: any};
      console.error("Error in generatePitchFlow (AI):", error, "Input was:", JSON.stringify(input, null, 2));
      
      let errorMessage = `AI service error during pitch generation: ${error.message}.`;
      if (error.message?.includes("GenkitInitError:") || error.message?.toLowerCase().includes("api key") || error.message?.toLowerCase().includes("permission denied") || error.message?.toLowerCase().includes("quota")) {
        errorMessage = `AI Service Initialization or Access Error: ${error.message}. Please verify your GOOGLE_API_KEY, Google Cloud project settings (ensure Gemini API is enabled and billing is active), and check for quota issues.`;
      } else if (error.cause && typeof error.cause === 'object' && 'message' in error.cause) {
        errorMessage += ` Caused by: ${error.cause.message}`;
      }

      return {
        ...placeholderOutput,
        pitchTitle: "Pitch Generation Failed - AI Service Error",
        warmIntroduction: `Rebuttal generation failed due to an AI service error: ${errorMessage.substring(0,200)}... (Check server logs for full details)`,
        fullPitchScript: `Pitch Generation Aborted. Details: ${errorMessage}`,
        notesForAgent: "AI service error. Check API key, model access, quotas, and server logs."
      };
    }
  }
);

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  const parseResult = GeneratePitchInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for generatePitch (AI):", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      // Return a structured error matching GeneratePitchOutputSchema
      pitchTitle: "Pitch Generation Failed - Invalid Input",
      warmIntroduction: `There was an issue with the input provided: ${errorMessages}`,
      personalizedHook: "Input validation failed.",
      productExplanation: "Input validation failed.",
      keyBenefitsAndBundles: "Input validation failed.",
      discountOrDealExplanation: "Input validation failed.",
      objectionHandlingPreviews: "Input validation failed.",
      finalCallToAction: "Input validation failed.",
      fullPitchScript: `Pitch generation aborted due to invalid input. Details: ${errorMessages}`,
      estimatedDuration: "N/A",
      notesForAgent: "Input validation failed. Check console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow (AI) from exported function:", error);
    return {
      // Return a structured error matching GeneratePitchOutputSchema
      pitchTitle: "Pitch Generation Error - Critical System Issue",
      warmIntroduction: `Pitch generation failed due to a critical system error: ${error.message}.`,
      personalizedHook: "System error.",
      productExplanation: "System error.",
      keyBenefitsAndBundles: "System error.",
      discountOrDealExplanation: "System error.",
      objectionHandlingPreviews: "System error.",
      finalCallToAction: "System error.",
      fullPitchScript: `Pitch generation failed. Details: ${error.message}`,
      estimatedDuration: "N/A",
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}


      