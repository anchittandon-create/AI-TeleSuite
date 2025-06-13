
'use server';

/**
 * @fileOverview Generates a sales pitch using Knowledge Base content and input parameters (Template-based).
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

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
  warmIntroduction: z.string().describe("A brief, friendly opening."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort."),
  productExplanation: z.string().min(10).describe("Explanation of the product, primarily from Knowledge Base."),
  keyBenefitsAndBundles: z.string().min(10).describe("Key benefits and bundled offers, guiding agent to use KB."),
  discountOrDealExplanation: z.string().describe("Explanation of any special discount or deal."),
  objectionHandlingPreviews: z.string().describe("Guidance for common objections, referring to KB."),
  finalCallToAction: z.string().describe("A clear call to action."),
  fullPitchScript: z.string().min(50).describe("The complete, integrated sales pitch script."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the full pitch script.'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the agent.")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

// AI Prompt and related AI model calls are removed.

const generatePitchFlow = async (input : GeneratePitchInput) : Promise<GeneratePitchOutput> => {
    const {
        product,
        customerCohort,
        etPlanConfiguration,
        knowledgeBaseContext,
        salesPlan,
        offer,
        agentName = "I", // Default if not provided
        userName = "there" // Default if not provided
    } = input;

    if (knowledgeBaseContext === "No specific knowledge base content found for this product." || knowledgeBaseContext.trim().length < 10) {
      return {
        pitchTitle: `Pitch Generation Failed - Insufficient Knowledge Base for ${product}`,
        warmIntroduction: `Hello ${userName}, this is ${agentName} calling from ${product}.`,
        personalizedHook: `(Tailor hook for ${customerCohort} based on available info.)`,
        productExplanation: `Cannot Generate Full Pitch: The Knowledge Base content provided for ${product} is insufficient. Please add detailed information to the Knowledge Base.`,
        keyBenefitsAndBundles: `(Refer to Knowledge Base for key benefits and bundle details for ${product}.)`,
        discountOrDealExplanation: `(Explain any applicable offer: ${offer || 'N/A'} for plan: ${salesPlan || 'N/A'}. Agent to insert price.)`,
        objectionHandlingPreviews: `(Refer to Knowledge Base for common objections and their rebuttals for ${product}.)`,
        finalCallToAction: `(Formulate a clear call to action, e.g., 'Would you like to proceed?')`,
        fullPitchScript: `Pitch Generation Aborted: Insufficient Knowledge Base content for ${product}. The AI needs more details to craft a meaningful pitch. Please update the Knowledge Base. Agent to use available KB content for ${product} and customer cohort ${customerCohort}.`,
        estimatedDuration: "N/A",
        notesForAgent: `Ensure the Knowledge Base for ${product} is populated with comprehensive details. Pitch generation relies heavily on this content.`
      };
    }

    const pitchTitle = `Tailored ${product} Pitch for ${customerCohort}`;
    
    const warmIntroduction = `Hello ${userName}, this is ${agentName} calling from ${product}. How are you today?`;
    
    let personalizedHook = `I'm reaching out to you today as a valued ${customerCohort}. `;
    if (product === "ET" && etPlanConfiguration) {
        personalizedHook += `We noticed you might be interested in our ET Prime subscription, perhaps looking at our ${etPlanConfiguration}. `;
    } else {
        personalizedHook += `We have some exciting information about ${product} that could be beneficial for you. `;
    }

    const productExplanation = `Let me tell you a bit about ${product}. It offers:\n${knowledgeBaseContext.substring(0, 800)}${knowledgeBaseContext.length > 800 ? "\n...(Full details in Knowledge Base)" : ""}\n(Agent: Elaborate on core value based on the full Knowledge Base content.)`;
    
    const keyBenefitsAndBundles = `Some of the key benefits you'll enjoy with ${product} include: (Agent: Highlight 2-3 key benefits from the Knowledge Base). Additionally, if there are bundled offers like TimesPrime or Docubay, they provide: (Agent: Explain value of bundles if mentioned in KB).`;
    
    let discountOrDealExplanation = `Regarding our plans and offers`;
    if (salesPlan) discountOrDealExplanation += `, for the ${salesPlan} plan`;
    if (offer) discountOrDealExplanation += `, we currently have a special offer: ${offer}`;
    discountOrDealExplanation += `. The price for this would be <INSERT_PRICE>. (Agent: Clearly articulate the value of this specific offer or available plans based on KB).`;
    if (!salesPlan && !offer) discountOrDealExplanation = `We have several attractive subscription plans available for ${product}. (Agent: Discuss suitable plans and pricing from KB).`;

    const objectionHandlingPreviews = `Should you have any questions, for common concerns such as price or need, we can discuss how ${product} offers great value. (Agent: Refer to 'Common Selling Themes' or product strengths in the Knowledge Base to address potential objections).`;
    
    const finalCallToAction = `So, ${userName}, would you be interested in getting started with ${product} today? Or perhaps I can send you a link with more details on this offer?`;

    const fullPitchScript = [
        pitchTitle,
        `--- Script Start ---`,
        warmIntroduction,
        personalizedHook,
        `Product Overview (${product}):`,
        productExplanation.replace("(Agent: Elaborate on core value based on the full Knowledge Base content.)", "").replace(`${knowledgeBaseContext.substring(0, 800)}${knowledgeBaseContext.length > 800 ? "\n...(Full details in Knowledge Base)" : ""}`, `\n${knowledgeBaseContext}\n`),
        `Key Benefits & Bundles:`,
        keyBenefitsAndBundles.replace("(Agent: Highlight 2-3 key benefits from the Knowledge Base).", "[Agent to detail benefits from KB]").replace("(Agent: Explain value of bundles if mentioned in KB).", "[Agent to detail bundles from KB]"),
        `Offer & Pricing:`,
        discountOrDealExplanation.replace("(Agent: Clearly articulate the value of this specific offer or available plans based on KB).", "[Agent to insert price and explain value from KB]"),
        `Addressing Questions:`,
        objectionHandlingPreviews.replace("(Agent: Refer to 'Common Selling Themes' or product strengths in the Knowledge Base to address potential objections).", "[Agent to proactively address based on KB]"),
        finalCallToAction,
        `--- Script End ---`
    ].join('\n\n');

    const estimatedDuration = "3-5 minutes (agent to adjust based on delivery)";
    
    const notesForAgent = `This is a template. Rely heavily on the full Knowledge Base for ${product} to provide specific details for features, benefits, current offers, and objection handling. Tailor your delivery to ${customerCohort}. Remember to fill in <INSERT_PRICE>.`;

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
        estimatedDuration,
        notesForAgent
    };
};

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  const parseResult = GeneratePitchInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for generatePitch (Template-based):", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      pitchTitle: "Pitch Generation Failed - Invalid Input",
      warmIntroduction: `Input validation failed: ${errorMessages}`,
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
    console.error("Catastrophic error calling generatePitchFlow (Template-based):", error);
    return {
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
