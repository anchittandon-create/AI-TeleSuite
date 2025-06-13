
'use server';

/**
 * @fileOverview Generates a sales pitch using Knowledge Base content and input parameters, without AI model generation.
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {z} from 'genkit';
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
  productExplanation: z.string().describe("Explanation of {{{PRODUCT_NAME}}} directly from the 'Knowledge Base Context'. This section will include a significant portion of the provided KB content."),
  keyBenefitsAndBundles: z.string().describe("Guidance to the agent to refer to the 'Knowledge Base Context' for key product features, benefits, and any bundled offers (e.g., TimesPrime, Docubay), along with their value."),
  discountOrDealExplanation: z.string().describe("Explanation of any special discount, pricing for the {{PLAN_NAME}}, or bundled offer ({{OFFER_DETAILS}}). Uses the placeholder `<INSERT_PRICE>`."),
  objectionHandlingPreviews: z.string().describe("Guidance to the agent to refer to the 'Knowledge Base Context' (especially 'Common Selling Themes' or product strengths) for handling potential customer objections related to {{{PRODUCT_NAME}}}."),
  finalCallToAction: z.string().describe("A clear call to action, encouraging the customer to subscribe or take the next step."),
  fullPitchScript: z.string().describe("The complete, integrated sales pitch script, formatted for easy reading and delivery. This script weaves together all the above sections seamlessly. Uses placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, and <INSERT_PRICE>."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the full pitch script (e.g., "3-5 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the sales agent delivering the pitch (e.g., 'Emphasize ad-free experience for Paywall Dropoff cohort').")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const placeholderOutput: GeneratePitchOutput = {
  pitchTitle: "Pitch Generation Failed - Configuration Issue",
  warmIntroduction: "Could not generate pitch. Ensure Knowledge Base has relevant information for the selected product.",
  personalizedHook: "Please ensure Knowledge Base has relevant information for the selected product and cohort.",
  productExplanation: "Pitch generation requires sufficient information about the product from the Knowledge Base.",
  keyBenefitsAndBundles: "Refer to Knowledge Base for key benefits and bundle details.",
  discountOrDealExplanation: "Refer to Knowledge Base or provide offer details for this section.",
  objectionHandlingPreviews: "Refer to Knowledge Base for common objections and their rebuttals.",
  finalCallToAction: "Formulate a call to action based on the offer and conversation.",
  fullPitchScript: "Pitch Generation Aborted. Check Knowledge Base for the selected product. This pitch is constructed directly from KB content.",
  estimatedDuration: "N/A",
  notesForAgent: "Review Knowledge Base for the selected product and try again."
};


const generatePitchFlow = async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      console.warn("generatePitchFlow (Non-AI): No KB context provided or KB is empty for product:", input.product);
      return {
        ...placeholderOutput,
        pitchTitle: `Pitch Template - Missing Knowledge Base for ${input.product}`,
        warmIntroduction: `Cannot Generate Full Pitch: No relevant knowledge base content was found for ${input.product}. Please add information to the Knowledge Base.`,
        productExplanation: `Pitch generation requires sufficient information about ${input.product} from the Knowledge Base. Please populate the Knowledge Base. The content you add will appear here.`,
        fullPitchScript: `Pitch Template Incomplete: Missing essential Knowledge Base content for ${input.product}. Please update the Knowledge Base.`,
        notesForAgent: `Ensure Knowledge Base is populated for ${input.product}. This pitch template relies directly on KB data.`
      };
    }

    const agentName = input.agentName || "{{AGENT_NAME}}";
    const userName = input.userName || "{{USER_NAME}}";
    const productName = input.product;
    const customerCohort = input.customerCohort;
    const salesPlan = input.salesPlan || "{{PLAN_NAME}}";
    const offerDetails = input.offer || "{{OFFER_DETAILS}}";
    
    const pitchTitle = `Unlock Exclusive Insights with ${productName} – Special Offer for You!`;
    
    const warmIntroduction = `Hi ${userName}, this is ${agentName} calling from ${productName}. How are you doing today?`;

    let personalizedHook = "";
    switch (customerCohort) {
        case "Payment Dropoff":
            personalizedHook = `I'm calling because I noticed you were close to subscribing to ${productName} but might have faced an issue with the payment. We have an exclusive offer for you to complete it easily today.`;
            break;
        case "Plan Page Dropoff":
            personalizedHook = `I see you recently explored our ${productName} plans. I wanted to quickly share some key benefits and a special offer we have for you.`;
            break;
        case "Paywall Dropoff":
            personalizedHook = `You recently showed interest in ${productName}'s premium content. I'd love to highlight the value you get with a subscription and a special offer available.`;
            break;
        default:
            personalizedHook = `We're reaching out to our valued ${customerCohort} like you with some exciting updates and a special offer for ${productName}.`;
    }

    const productExplanation = `
Let me tell you a bit about ${productName}. 
(Agent: Refer to the detailed product information below, extracted from the Knowledge Base, and elaborate on key aspects relevant to the customer.)
--- KNOWLEDGE BASE CONTEXT FOR ${productName} ---
${input.knowledgeBaseContext}
--- END KNOWLEDGE BASE CONTEXT ---
`;

    const keyBenefitsAndBundles = `
(Agent: Based on the Knowledge Base context above, highlight 2-4 distinct key features and explicitly state the customer benefit for each. If the KB mentions bundled offers like TimesPrime or Docubay, describe these bundles and their added value.)
Example structure:
- Feature A from KB -> Benefit to customer...
- Feature B from KB -> Benefit to customer...
- Bundle X from KB -> Added value...
`;

    const discountOrDealExplanation = `
We have a special offer for you on the ${salesPlan} plan for ${productName}. The price is just <INSERT_PRICE>. ${offerDetails ? `This also includes ${offerDetails}.` : ''}
(Agent: Clearly articulate the value of this specific offer and mention any urgency if applicable.)
`;

    const objectionHandlingPreviews = `
(Agent: Be prepared for common objections. Refer to the 'Common Selling Themes' or product strengths in the Knowledge Base to formulate your responses. Example: If customer says "it's too expensive", counter with value for money points from KB.)
`;

    const finalCallToAction = `Would you like me to help you complete the subscription for ${productName} now so you can start enjoying these benefits? Or shall I send you a link to activate this special offer?`;

    const fullPitchScript = `
${pitchTitle}

Agent Notes: ${input.notesForAgent || "Tailor the pitch to the customer's responses."}
Estimated Duration: 3-5 minutes (depending on customer interaction)

--- SCRIPT START ---

${warmIntroduction}

${personalizedHook}

${productExplanation}

${keyBenefitsAndBundles}

${discountOrDealExplanation}

${objectionHandlingPreviews}

${finalCallToAction}

--- SCRIPT END ---
    `;

    return {
        pitchTitle,
        warmIntroduction,
        personalizedHook,
        productExplanation,
        keyBenefitsAndBundles,
        discountOrDealExplanation,
        objectionHandlingPreviews,
        finalCallToAction,
        fullPitchScript,
        estimatedDuration: "3-5 minutes",
        notesForAgent: input.notesForAgent || "Remember to listen to the customer and adapt the pitch based on their responses and needs. Use the Knowledge Base to support your points."
    };
};

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  const parseResult = GeneratePitchInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for generatePitch (Non-AI):", parseResult.error.format());
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
    // No Genkit flow or AI call needed here, directly call the synchronous construction logic
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow (Non-AI) from exported function:", error);
    return {
      ...placeholderOutput,
      pitchTitle: "Pitch Generation Error - System Issue",
      warmIntroduction: `Pitch generation failed due to a critical system error: ${error.message}.`,
      fullPitchScript: `Pitch generation failed. Details: ${error.message}`,
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}
