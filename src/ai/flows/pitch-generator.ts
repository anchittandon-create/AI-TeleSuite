
'use server';

/**
 * @fileOverview Generates a sales pitch by structuring content directly from the Knowledge Base and input parameters.
 * - generatePitch - A function that handles the sales pitch structuring.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {z} from 'zod';
import { Product, PRODUCTS, ETPlanConfiguration, ET_PLAN_CONFIGURATIONS, SalesPlan, SALES_PLANS, CustomerCohort, CUSTOMER_COHORTS } from '@/types';

// Input schema remains the same
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

// Output schema remains the same, but its fields will be populated by template logic
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

const placeholderOutput: GeneratePitchOutput = {
  pitchTitle: "Pitch Generation Failed - Configuration Issue",
  warmIntroduction: "Could not structure pitch. Knowledge Base content might be missing or a system error occurred.",
  personalizedHook: "Please ensure Knowledge Base has relevant information for the selected product.",
  productExplanation: "The system requires Knowledge Base content to explain the product.",
  keyBenefitsAndBundles: "Key benefits and bundles are derived from the Knowledge Base.",
  discountOrDealExplanation: "Offer details will be populated here based on your input and KB.",
  objectionHandlingPreviews: "Common objections and their previews are based on KB content.",
  finalCallToAction: "A call to action will be formulated here.",
  fullPitchScript: "Pitch Generation Aborted. Check Knowledge Base and system logs.",
  estimatedDuration: "N/A",
  notesForAgent: "Review Knowledge Base for the selected product and try again."
};

// This function now directly constructs the pitch output from the input and KB context.
async function structurePitchFromKB(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
    return {
      ...placeholderOutput,
      pitchTitle: `Pitch Generation Failed - Missing Knowledge Base for ${input.product}`,
      warmIntroduction: `Cannot Generate Pitch: No relevant knowledge base content was found for ${input.product}. Please add information to the Knowledge Base.`,
      productExplanation: `Pitch generation requires sufficient information about ${input.product} from the Knowledge Base.`,
      fullPitchScript: `Pitch Generation Aborted: Missing essential Knowledge Base content for ${input.product}. Please update the Knowledge Base.`,
      notesForAgent: `Ensure Knowledge Base is populated for ${input.product}. This pitch could not be generated due to missing KB data.`
    };
  }

  const agentName = input.agentName || "I";
  const userName = input.userName || "you"; // Use "you" if userName is not provided
  const productName = input.product;
  const cohort = input.customerCohort;
  const planName = input.salesPlan || "our current plans"; // Placeholder if not specified
  const offerDetails = input.offer || "our special offers"; // Placeholder if not specified

  const pitchTitle = `Tailored Pitch for ${productName} - Target: ${cohort}`;
  
  const warmIntroduction = `Hi ${userName}, this is ${agentName} calling from ${productName}. How are you doing today?`;

  let personalizedHook = "";
  switch (cohort) {
    case "Payment Dropoff":
      personalizedHook = `I'm reaching out because I noticed you were trying to subscribe to ${productName} and might have faced an issue with the payment. We have an easy way to complete that, and perhaps a special offer for you.`;
      break;
    case "Plan Page Dropoff":
      personalizedHook = `I saw you were recently looking at our ${productName} plans. I'd love to quickly clarify any details and share some benefits you might find valuable. We also have a special offer for ${planName}.`;
      break;
    case "Paywall Dropoff":
      personalizedHook = `I noticed you were interested in our premium content on ${productName} but might have hit a paywall. I wanted to explain the value you get with a subscription.`;
      break;
    default: // Generic hook for other cohorts
      personalizedHook = `We're reaching out to our valued users like yourself from the ${cohort} group with some exciting information about ${productName}.`;
  }

  // Product explanation will directly use KB content, encouraging agent to elaborate.
  const productExplanation = `Let me tell you a bit about ${productName}. It's designed to help users like you from the ${cohort} segment by providing:
---
${input.knowledgeBaseContext.substring(0, 1500)} ${input.knowledgeBaseContext.length > 1500 ? "\n...(Knowledge Base content summarized, agent to refer to full KB for details)" : ""}
---
(Agent: Refer to the full Knowledge Base for more detailed feature-to-benefit explanations for ${productName} relevant to the ${cohort}.)`;

  const keyBenefitsAndBundles = `With ${productName}, you get several key benefits. 
(Agent: Please highlight 2-3 primary benefits from the Knowledge Base that are most relevant to the ${cohort}. If applicable, explain any bundled offers like TimesPrime or Docubay and their value, based on the KB.)`;

  let discountOrDealExplanation = `Regarding our current plans, for the ${planName}, the price is <INSERT_PRICE>. This includes ${offerDetails}.`;
  if (!input.salesPlan && !input.offer) {
    discountOrDealExplanation = `We have several attractive plans available for ${productName}. I can share the details with you. (Agent: Discuss available plans and pricing, mentioning any specific offers if applicable from internal sales guidelines or the KB.)`;
  } else if (input.salesPlan && !input.offer) {
    discountOrDealExplanation = `For the ${planName} of ${productName}, the price is <INSERT_PRICE>. (Agent: Elaborate on the value of this plan based on KB.)`;
  } else if (!input.salesPlan && input.offer) {
     discountOrDealExplanation = `We currently have a special offer: ${offerDetails} for ${productName} subscribers, with pricing at <INSERT_PRICE>. (Agent: Explain the offer terms and value from KB/guidelines.)`;
  }

  const objectionHandlingPreviews = `Some common questions we get are about [common objection 1] or [common objection 2]. 
(Agent: Be prepared to address these. Consult the Knowledge Base for standard rebuttals and product strengths to counter these objections. Focus on value and benefits.)`;

  const finalCallToAction = `So, ${userName}, would you be interested in getting started with ${productName} today with this ${offerDetails} on the ${planName}? I can help you set that up right now.`;

  // Constructing the full pitch script by joining the templated parts
  const fullPitchScript = [
    `Pitch Title: ${pitchTitle}`,
    `Agent: ${agentName}`,
    `Customer: ${userName}`,
    `Product: ${productName}`,
    `Cohort: ${cohort}`,
    `\n--- SCRIPT START ---`,
    `\n${warmIntroduction}`,
    `\n${personalizedHook}`,
    `\nProduct Overview:`,
    productExplanation, // This now includes the KB context directly
    `\nKey Benefits & Bundles:`,
    keyBenefitsAndBundles,
    `\nOffer & Pricing:`,
    discountOrDealExplanation,
    `\nAnticipating Questions:`,
    objectionHandlingPreviews,
    `\n${finalCallToAction}`,
    `\n--- SCRIPT END ---`
  ].join('\n\n'); // Using double newlines for better readability between sections

  return {
    pitchTitle,
    warmIntroduction,
    personalizedHook,
    productExplanation, // This is now more direct
    keyBenefitsAndBundles,
    discountOrDealExplanation,
    objectionHandlingPreviews,
    finalCallToAction,
    fullPitchScript,
    estimatedDuration: "Varies (Agent-led, based on KB and interaction)",
    notesForAgent: `This pitch is a structured template. Key Task: YOU MUST actively use the full Knowledge Base content for ${productName} to elaborate on features, translate them into compelling benefits, and handle specific objections tailored to the ${cohort}. The KB context provided in the 'Product Explanation' section is a starting point. Adapt your tone and emphasis based on the customer's live responses. Ensure you have current pricing and offer details readily available.`
  };
}

// Exported function that directly calls the structuring logic.
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
    return await structurePitchFromKB(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Error in pitch structuring (non-AI):", error);
    return {
      ...placeholderOutput,
      pitchTitle: "Pitch Structure Error - System Issue",
      warmIntroduction: `Pitch structuring failed due to a system error: ${error.message}.`,
      fullPitchScript: `Pitch structuring failed. Details: ${error.message}`,
      notesForAgent: "Critical system error during pitch structuring. Check server logs."
    };
  }
}

    