
'use server';

/**
 * @fileOverview Generates a sales pitch using Knowledge Base content and input parameters.
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
  model: 'googleai/gemini-1.5-flash-latest', // Capable model
  config: {
    temperature: 0.5, // Balanced temperature for creative yet factual output
  },
  prompt: `You are a GenAI-powered telesales assistant trained to generate high-conversion sales pitches for premium Indian media subscriptions: {{{product}}}.
Your task is to generate a professional, persuasive, 3–5 minute telesales pitch (approximately 450-600 words) that an agent can read aloud.
Adhere strictly to the following structure and guidelines.

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

CRITICAL INSTRUCTION: The 'Knowledge Base Context' provided below is your *ONLY* source of truth for product features, benefits, and specific details about {{{product}}}. You MUST NOT invent, assume, or infer any features, benefits, pricing, or details that are not EXPLICITLY stated in the 'Knowledge Base Context'. Prioritize explaining customer *benefits* derived from features rather than just listing features.

Knowledge Base Context (Your Sole Source for Product Details):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Output Generation Rules:
- You MUST populate EVERY field in the 'GeneratePitchOutputSchema'.
- If the 'Knowledge Base Context' is insufficient to fully detail a section (e.g., 'keyBenefitsAndBundles' or 'objectionHandlingPreviews'), you MUST still populate the field. In such cases, briefly state what information would normally go there and explicitly mention that the agent should refer to the comprehensive Knowledge Base for more details if available. DO NOT leave fields blank or fail generation.
- Ensure the 'fullPitchScript' is well-structured and integrates all other generated sections.
- The overall pitch (fullPitchScript) should be between 450-600 words. Adjust detail in sections to meet this length.

Pitch Structure and Content Guidelines (Populate ALL fields based on this):
1.  **pitchTitle**: Create a compelling title for this specific pitch.
2.  **warmIntroduction**: Start with a friendly greeting. Introduce the agent (using "{{agentName}}" if provided, otherwise "your agent") and the brand ("{{{product}}}").
3.  **personalizedHook**: Mention the purpose of the call clearly. Personalize this hook based on the "{{customerCohort}}":
    *   If 'Payment Drop-off': Emphasize offer urgency and ease of completion.
    *   If 'Plan Page Drop-off': Clarify plan details (using "{{salesPlan}}" and "{{offer}}" if available) and highlight specific benefits from the Knowledge Base.
    *   If 'Paywall Drop-off': Focus on the content quality and long-term value from the Knowledge Base.
    *   If 'Assisted Buying': Be direct, goal-oriented, and mention agent assistance.
    *   If 'Renewal Drop-off' or 'Expired Users': Reinforce continued value, highlight upgrades or special deals for returning users from the Knowledge Base.
    *   For other cohorts, adapt the hook logically based on the cohort's meaning and information from the Knowledge Base.
4.  **productExplanation**: Concisely explain what {{{product}}} is. Use brand-specific benefit language derived *only* from the Knowledge Base Context.
    *   For ET Prime: Mention (if in KB) deep market analysis, expert investment research, ad-free reading, exclusive reports, trusted by India’s top business readers.
    *   For TOI Plus: Mention (if in KB) premium editorial journalism, ad-free access, early content access, in-depth coverage, trusted voice of India.
    *   Focus on translating features found *ONLY* in the Knowledge Base Context into clear, compelling *customer advantages and benefits* relevant to the "{{customerCohort}}".
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits* of {{{product}}}. These MUST be derived from the Knowledge Base Context. Explain what the customer *gains* from these features. If bundles (e.g., TimesPrime, Docubay) are mentioned in the KB, explain their *added value and specific benefits* to the customer.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal confidently. Use the placeholder "<INSERT_PRICE>" for the actual price amount, which the agent will fill in. Clearly articulate the value of this specific offer. If no plan/offer is specified, briefly mention that attractive plans are available.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, trust, hesitation) with brief, benefit-oriented rebuttals. These rebuttals must be based on information *found only* in the Knowledge Base Context (e.g., using 'Common Selling Themes' like Value for Money, Productivity Boost if present in KB).
8.  **finalCallToAction**: Conclude with a strong call to action, such as: "Would you like me to help you complete the subscription now?" or "Shall I send you a link to activate the offer before it expires?"
9.  **fullPitchScript**: This is the main output. Ensure this script comprehensively and smoothly integrates *all* the detailed content generated for the individual sections above. Combine all sections into a single, flowing script of 450-600 words. Use placeholders like {{agentName}}, {{userName}}, {{product}}, {{customerCohort}}, {{salesPlan}}, {{offer}}, and <INSERT_PRICE> where appropriate. The script should sound natural, be broken into manageable paragraphs, and be easy for a telesales agent to deliver.
10. **estimatedDuration**: Estimate the speaking time for the 'fullPitchScript' (e.g., "3-5 minutes").
11. **notesForAgent** (Optional): Provide 1-2 brief, actionable notes for the agent delivering this specific pitch, based on the product and cohort.

Tone Guidelines:
- Conversational, confident, respectful of the user’s time.
- Avoid robotic repetition or sales clichés. Be helpful, not pushy.
- Use simple English. Subtle Hinglish elements are acceptable if they sound natural for a telesales context in India, but prioritize clarity.

Generate the pitch.
`,
});

const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim().length < 10) {
      return {
        pitchTitle: "Pitch Generation Failed - Insufficient Knowledge Base",
        warmIntroduction: `The Knowledge Base content provided for ${input.product} is insufficient or missing. Please add detailed product information to the Knowledge Base.`,
        personalizedHook: "(KB content insufficient)",
        productExplanation: "(KB content insufficient)",
        keyBenefitsAndBundles: "(KB content insufficient)",
        discountOrDealExplanation: "(KB content insufficient)",
        objectionHandlingPreviews: "(KB content insufficient)",
        finalCallToAction: "(KB content insufficient)",
        fullPitchScript: `Pitch Generation Aborted: Insufficient Knowledge Base content for ${input.product}. The AI needs more details to craft a meaningful pitch. Please update the Knowledge Base.`,
        estimatedDuration: "N/A",
        notesForAgent: `Ensure the Knowledge Base for ${input.product} is populated with comprehensive details. Pitch generation relies heavily on this content.`
      };
    }

    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.fullPitchScript || output.fullPitchScript.trim().length < 50) {
        console.error("generatePitchFlow: AI Prompt returned no or very short fullPitchScript. Input was:", JSON.stringify(input, null, 2).substring(0, 1000)); // Log truncated input
        let fallbackMessage = "The AI model failed to generate a complete pitch script. This might be due to the complexity of the request or limitations with the provided Knowledge Base content. ";
        if (input.knowledgeBaseContext.length < 100) {
            fallbackMessage += "The available information for this product might be too limited. Please enhance the Knowledge Base.";
        } else {
            fallbackMessage += "Please try again, or simplify the request if the Knowledge Base content is very extensive.";
        }
        return {
          pitchTitle: "Pitch Generation Failed - AI Output Issue",
          warmIntroduction: fallbackMessage,
          personalizedHook: "(AI failed to generate content for this section)",
          productExplanation: "(AI failed to generate content for this section)",
          keyBenefitsAndBundles: "(AI failed to generate content for this section)",
          discountOrDealExplanation: "(AI failed to generate content for this section)",
          objectionHandlingPreviews: "(AI failed to generate content for this section)",
          finalCallToAction: "(AI failed to generate content for this section)",
          fullPitchScript: `Pitch Generation Aborted by AI: ${fallbackMessage}`,
          estimatedDuration: "N/A",
          notesForAgent: "AI failed to generate the pitch. Check the Knowledge Base or try again. The AI model might have encountered an issue processing the request."
        };
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow (AI part):", error, "Input (truncated):", JSON.stringify(input, null, 2).substring(0, 1000));
      let specificMessage = `The AI service encountered an error: ${error.message}.`;
      if (error.message && (error.message.includes("GenkitInitError:") || error.message.toLowerCase().includes("api key"))) {
        specificMessage = `AI Service Initialization Error. ${error.message}. Please verify your GOOGLE_API_KEY and Google Cloud project settings.`;
      } else if (error.message.toLowerCase().includes("safety settings") || error.message.toLowerCase().includes("blocked")) {
        specificMessage = `AI content generation was blocked, possibly by safety filters. Please review the Knowledge Base content for '${input.product}' for potentially sensitive terms and try again. (Error: ${error.message})`;
      } else if (error.message.toLowerCase().includes("candidate encontraba no content")) { // Specific error for "candidate not found"
        specificMessage = `The AI model did not return any valid content, possibly due to the prompt or input data. (Error: ${error.message})`;
      }


      return {
        pitchTitle: "Pitch Generation Error - AI Service Failure",
        warmIntroduction: `Pitch generation failed due to an AI service error. Details: ${specificMessage.substring(0,250)}... (Check server logs for full error and input details)`,
        personalizedHook: `(AI Error: ${error.message.substring(0,50)}...)`,
        productExplanation: `(AI Error: ${error.message.substring(0,50)}...)`,
        keyBenefitsAndBundles: `(AI Error: ${error.message.substring(0,50)}...)`,
        discountOrDealExplanation: `(AI Error: ${error.message.substring(0,50)}...)`,
        objectionHandlingPreviews: `(AI Error: ${error.message.substring(0,50)}...)`,
        finalCallToAction: `(AI Error: ${error.message.substring(0,50)}...)`,
        fullPitchScript: `Pitch Generation Failed. AI Service Error: ${specificMessage}. Please check server logs. Also, review the Knowledge Base content for '${input.product}' for any unusual characters or excessive length. Ensure your API key is correctly configured and has access to the 'gemini-1.5-flash-latest' model.`,
        estimatedDuration: "N/A",
        notesForAgent: `AI Service Error: ${error.message.substring(0,100)}... Check API key, model access, and KB content for ${input.product}. If the error mentions safety filters or blocked content, review your Knowledge Base text for product '${input.product}'.`
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
      notesForAgent: "Input validation failed. Check console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow:", error);
    return {
      pitchTitle: "Pitch Generation Error - Critical System Issue",
      warmIntroduction: `Pitch generation failed due to a critical system error: ${error.message.substring(0,250)}.`,
      personalizedHook: "(System error)",
      productExplanation: "(System error)",
      keyBenefitsAndBundles: "(System error)",
      discountOrDealExplanation: "(System error)",
      objectionHandlingPreviews: "(System error)",
      finalCallToAction: "(System error)",
      fullPitchScript: `Pitch generation failed. Details: ${error.message}`,
      estimatedDuration: "N/A",
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}
