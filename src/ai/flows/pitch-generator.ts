
'use server';

/**
 * @fileOverview Generates a sales pitch using Knowledge Base content and input parameters.
 * This version DOES NOT use an AI model; it constructs the pitch from templates.
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

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

// This flow no longer uses an AI model. It constructs the pitch directly.
const generatePitchFlow = async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
  const {
    product,
    customerCohort,
    etPlanConfiguration,
    knowledgeBaseContext,
    salesPlan,
    offer,
    agentName,
    userName,
  } = input;

  const AGENT_PLACEHOLDER = agentName || "{{AGENT_NAME}}";
  const USER_PLACEHOLDER = userName || "{{USER_NAME}}";
  const PRODUCT_PLACEHOLDER = product;
  const COHORT_PLACEHOLDER = customerCohort;
  const PLAN_PLACEHOLDER = salesPlan || "{{PLAN_NAME}}";
  const OFFER_PLACEHOLDER = offer || "{{OFFER_DETAILS}}";

  const kbProvided = knowledgeBaseContext && knowledgeBaseContext.trim().length > 10 && knowledgeBaseContext !== "No specific knowledge base content found for this product.";
  const kbWarning = " (Refer to full Knowledge Base for comprehensive details if this section is brief due to limited KB input.)";

  const output: GeneratePitchOutput = {
    pitchTitle: `Sales Pitch for ${product} to ${customerCohort}`,
    warmIntroduction: `Hello ${USER_PLACEHOLDER}, this is ${AGENT_PLACEHOLDER} calling from ${PRODUCT_PLACEHOLDER}. How are you today?`,
    personalizedHook: `I'm reaching out to you today because you're part of our '${COHORT_PLACEHOLDER}' group. We have something special that might interest you regarding ${PRODUCT_PLACEHOLDER}.`,
    productExplanation: kbProvided ? `Let me tell you about ${PRODUCT_PLACEHOLDER}. It's a premium offering that provides: ${knowledgeBaseContext.substring(0, 1000)}${knowledgeBaseContext.length > 1000 ? "..." : ""}${kbWarning}` : `Please refer to the Knowledge Base for a full explanation of ${PRODUCT_PLACEHOLDER}.${kbWarning}`,
    keyBenefitsAndBundles: kbProvided ? `Some key benefits of ${PRODUCT_PLACEHOLDER} include [Benefit 1 from KB], [Benefit 2 from KB], and [Benefit 3 from KB]. We also have attractive bundle options available.${kbWarning}` : `The key benefits and bundle options for ${PRODUCT_PLACEHOLDER} are detailed in the Knowledge Base. Please review them there.${kbWarning}`,
    discountOrDealExplanation: offer ? `We currently have a special offer for you: ${OFFER_PLACEHOLDER}. This is applicable for the ${PLAN_PLACEHOLDER} plan, priced at <INSERT_PRICE>.` : `We have various attractive subscription plans available for ${PRODUCT_PLACEHOLDER}, including the ${PLAN_PLACEHOLDER}. You can find pricing details by asking or checking our website.`,
    objectionHandlingPreviews: kbProvided ? `You might be thinking about [Common Objection 1], but with ${PRODUCT_PLACEHOLDER}, you get [Benefit from KB addressing Objection 1]. Similarly, for [Common Objection 2], consider [Another Benefit from KB].${kbWarning}` : `Common objections and their rebuttals for ${PRODUCT_PLACEHOLDER} are available in the Knowledge Base. Please consult it for effective responses.${kbWarning}`,
    finalCallToAction: `Would you be interested in subscribing to ${PRODUCT_PLACEHOLDER} today with this ${OFFER_PLACEHOLDER} offer? Or would you like me to share more details?`,
    estimatedDuration: "3-5 minutes",
    notesForAgent: `Focus on tailoring the benefits from the Knowledge Base to the '${COHORT_PLACEHOLDER}'. Emphasize the value of the '${OFFER_PLACEHOLDER}' if applicable. Always refer to the complete Knowledge Base for the most up-to-date and detailed information.`,
    fullPitchScript: "" // To be constructed
  };

  // Construct the full pitch script
  output.fullPitchScript = `
${output.pitchTitle}

Introduction:
${output.warmIntroduction}
${output.personalizedHook}

Product Overview:
${output.productExplanation}

Key Benefits & Offers:
${output.keyBenefitsAndBundles}
${output.discountOrDealExplanation}

Anticipating Concerns:
${output.objectionHandlingPreviews}

Closing:
${output.finalCallToAction}

Agent Notes:
${output.notesForAgent || 'Remember to personalize and be enthusiastic!'}
  `.trim().replace(/{{AGENT_NAME}}/g, agentName || "I")
      .replace(/{{USER_NAME}}/g, userName || "the customer")
      .replace(/{{PRODUCT_NAME}}/g, product)
      .replace(/{{USER_COHORT}}/g, customerCohort)
      .replace(/{{PLAN_NAME}}/g, salesPlan || "selected plan")
      .replace(/{{OFFER_DETAILS}}/g, offer || "current offers");

  if (output.fullPitchScript.length < 50) {
    output.fullPitchScript = "Error: Could not construct a valid pitch script from the provided information and Knowledge Base context. Please ensure the Knowledge Base is well-populated for the selected product.";
  }


  return output;
};

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  const parseResult = GeneratePitchInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for generatePitch:", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      pitchTitle: "Pitch Generation Failed - Invalid Input (Template Mode)",
      warmIntroduction: `Input validation failed: ${errorMessages.substring(0,250)}`,
      personalizedHook: "(Invalid input)",
      productExplanation: "(Invalid input)",
      keyBenefitsAndBundles: "(Invalid input)",
      discountOrDealExplanation: "(Invalid input)",
      objectionHandlingPreviews: "(Invalid input)",
      finalCallToAction: "(Invalid input)",
      fullPitchScript: `Pitch generation aborted due to invalid input (Template Mode). Details: ${errorMessages}`,
      estimatedDuration: "N/A",
      notesForAgent: "Input validation failed. Check console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow (Template Mode):", error);
    return {
      pitchTitle: "Pitch Generation Error - Critical System Issue (Template Mode)",
      warmIntroduction: `Pitch generation failed due to a critical system error: ${error.message.substring(0,250)}.`,
      personalizedHook: "(System error)",
      productExplanation: "(System error)",
      keyBenefitsAndBundles: "(System error)",
      discountOrDealExplanation: "(System error)",
      objectionHandlingPreviews: "(System error)",
      finalCallToAction: "(System error)",
      fullPitchScript: `Pitch generation failed due to a critical system error (Template Mode). Details: ${error.message}`,
      estimatedDuration: "N/A",
      notesForAgent: "Critical system error during pitch generation (Template Mode). Check server logs."
    };
  }
}
    

    