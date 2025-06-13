
'use server';

/**
 * @fileOverview Constructs a sales pitch based on the selected product, customer cohort, and Knowledge Base content.
 * This version directly uses Knowledge Base content without AI generation.
 * - generatePitch - A function that constructs the sales pitch.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

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

// No AI prompt needed for this version.

const generatePitchFlow = async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
  const {
    product,
    customerCohort,
    etPlanConfiguration,
    knowledgeBaseContext,
    salesPlan,
    offer,
    agentName = "your agent", // Default value
    userName = "Valued Customer", // Default value
  } = input;

  if (knowledgeBaseContext === "No specific knowledge base content found for this product." || knowledgeBaseContext.trim() === "") {
    return {
      pitchTitle: "Pitch Construction Failed - Missing Knowledge Base",
      warmIntroduction: "Cannot Construct Pitch: No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base.",
      personalizedHook: "Please ensure the Knowledge Base has entries for this product.",
      productExplanation: "Product details could not be retrieved from the Knowledge Base.",
      keyBenefitsAndBundles: "Benefits and bundle information missing from Knowledge Base.",
      discountOrDealExplanation: "Offer details cannot be formulated without product information.",
      objectionHandlingPreviews: "Rebuttals require Knowledge Base context.",
      finalCallToAction: "Action: Review Knowledge Base content for this product.",
      fullPitchScript: "Pitch Construction Aborted: Missing essential Knowledge Base content. Please update the Knowledge Base for " + product + ".",
      estimatedDuration: "N/A",
      notesForAgent: "Ensure Knowledge Base is populated for effective pitch construction. This pitch could not be constructed due to missing KB data."
    };
  }

  // Construct pitch components directly from inputs and KB context
  const pitchTitle = `Tailored Information for ${product} - ${customerCohort}`;
  
  const warmIntroduction = `Hi ${userName}, this is ${agentName} calling from ${product}. How are you doing today?`;
  
  let personalizedHook = `We're reaching out because you've been identified as part of our '${customerCohort}' group, and we have some information about ${product} that might be relevant to you.`;
  if (customerCohort === "Payment Dropoff") {
    personalizedHook = `I'm calling about your recent interest in ${product}. It seems there might have been an issue completing your subscription, and I'd be happy to help you get that sorted with our current offers.`;
  } else if (customerCohort === "Plan Page Dropoff") {
    personalizedHook = `I noticed you were recently looking at our ${product} plans. I wanted to see if I could help clarify anything or share some special offers we have available.`;
  } else if (customerCohort === "Paywall Dropoff") {
     personalizedHook = `You recently encountered our ${product} premium content. I'd love to share how subscribing can give you full access and much more.`;
  }


  let productExplanation = `Let me tell you a bit about ${product}. It's designed to offer significant value.
Here is some key information directly from our knowledge base:
--- KNOWLEDGE BASE START ---
${knowledgeBaseContext.substring(0, 1000)} 
${knowledgeBaseContext.length > 1000 ? "\n...(Knowledge base content truncated for brevity in this section)..." : ""}
--- KNOWLEDGE BASE END ---
`;

  const keyBenefitsAndBundles = `For specific benefits and bundle details, please refer to the comprehensive information in our Knowledge Base. We encourage you to discuss these points further. (This section would ideally list 2-4 key benefits extracted from the KB if it were structured for easy parsing, e.g., with 'Benefit:' prefixes). The provided knowledge base context above contains further details.`;

  let discountOrDealExplanation = `Regarding our current plans and offers for ${product}${salesPlan ? ` (specifically the ${salesPlan} plan)` : ''}:`;
  if (offer) {
    discountOrDealExplanation += ` We have a special offer: ${offer}.`;
  }
  discountOrDealExplanation += ` The price for the selected plan is <INSERT_PRICE>. We believe this offers great value.`;
  if (!salesPlan && !offer) {
    discountOrDealExplanation = `We have various attractive plans and occasional offers for ${product}. Please ask for the current pricing details, and the agent will provide the price as <INSERT_PRICE>.`;
  }


  const objectionHandlingPreviews = `Should you have any concerns, such as about cost or features, our Knowledge Base contains information that can help address common questions. For example, we often highlight the overall value and unique benefits. (This section would ideally list 1-2 common objections and their KB-derived rebuttals).`;

  const finalCallToAction = `Would you be interested in proceeding with a ${product} subscription today, or perhaps I can answer any more questions you have based on the information we've discussed?`;

  const fullPitchScript = [
    `**Pitch Title:** ${pitchTitle}\n`,
    `**Agent:** ${agentName}`,
    `**Customer:** ${userName}`,
    `**Product:** ${product}`,
    `**Cohort:** ${customerCohort}\n\n`,
    `**[SCENE START]**\n`,
    `**${agentName}:** ${warmIntroduction}\n`,
    `**${userName}:** (Responds)\n`,
    `**${agentName}:** ${personalizedHook}\n`,
    `**${agentName}:** ${productExplanation}\n`,
    `**${agentName}:** ${keyBenefitsAndBundles}\n`,
    `**${agentName}:** ${discountOrDealExplanation}\n`,
    `**${agentName}:** ${objectionHandlingPreviews}\n`,
    `**${agentName}:** ${finalCallToAction}\n`,
    `**[SCENE END]**`
  ].join('\n');

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
    estimatedDuration: "Varies (KB dependent)",
    notesForAgent: `This pitch is constructed directly from the Knowledge Base. Refer to the full KB context during the call. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, and <INSERT_PRICE> as appropriate. The current plan is: ${salesPlan || 'Not specified'}. Offer: ${offer || 'Not specified'}.`
  };
};

export async function generatePitch(input: GeneratePitchInput): Promise<GeneratePitchOutput> {
  // Validate input using Zod schema before processing
  const parseResult = GeneratePitchInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for generatePitch:", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      pitchTitle: "Pitch Construction Failed - Invalid Input",
      warmIntroduction: `There was an issue with the input provided: ${errorMessages}`,
      personalizedHook: "Please check the form inputs.",
      productExplanation: "", keyBenefitsAndBundles: "", discountOrDealExplanation: "",
      objectionHandlingPreviews: "", finalCallToAction: "",
      fullPitchScript: `Pitch construction aborted due to invalid input. Details: ${errorMessages}`,
      estimatedDuration: "N/A",
      notesForAgent: "Input validation failed. Check console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Error in generatePitch (direct KB construction):", error);
    return {
      pitchTitle: "Pitch Construction Error - System Issue",
      warmIntroduction: `A system error occurred while constructing the pitch: ${error.message}`,
      personalizedHook: "Please try again later or check system logs.",
      productExplanation: "", keyBenefitsAndBundles: "", discountOrDealExplanation: "",
      objectionHandlingPreviews: "", finalCallToAction: "",
      fullPitchScript: `Pitch construction failed due to a system error. Details: ${error.message}`,
      estimatedDuration: "N/A",
      notesForAgent: "System error during pitch construction. Check server logs."
    };
  }
}
