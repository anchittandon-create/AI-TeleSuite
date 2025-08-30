
'use server';

/**
 * @fileOverview Generates a sales pitch using an AI model, guided by Knowledge Base content and input parameters.
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'zod';
import type { Product, ETPlanConfiguration, SalesPlan, CustomerCohort } from '@/types';


// Updated Schema to include agentName and userName
const GeneratePitchInputSchema = z.object({
  product: z.string().min(1, "Product must be selected."),
  customerCohort: z.string().min(1, "Customer cohort must be selected."),
  etPlanConfiguration: z.string().optional(),
  knowledgeBaseContext: z.string().describe('A structured string of knowledge base content. It contains sections like "Pitch Structure & Flow Context" and "Product Details & Facts" which the AI must use for their designated purposes.'),
  salesPlan: z.string().optional(),
  offer: z.string().optional(),
  agentName: z.string().optional(),
  userName: z.string().optional(),
  brandName: z.string().optional(),
  lastCallFeedback: z.string().optional().describe("A summary of strengths and weaknesses from the last scored call, to be used for self-improvement.")
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;


const GeneratePitchOutputSchema = z.object({
  pitchTitle: z.string().describe("A compelling title for the sales pitch."),
  warmIntroduction: z.string().describe("A brief, friendly opening, introducing the agent (if name provided) and the product brand. This MUST be concise and derived *ONLY* from Knowledge Base cues if available (e.g., standard greeting), otherwise general professional greeting. Ensure this content is distinct from other sections."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call and possibly hinting at benefits or offers relevant to that cohort. This section MUST use specifics *ONLY* from the Knowledge Base if available for the cohort or product, otherwise a generic professional hook for the cohort. Ensure this content is distinct and does not repeat Warm Introduction or Product Explanation points."),
  productExplanation: z.string().min(10).describe("Clear explanation of the product, focusing on its core value proposition to the customer. This MUST be derived *ONLY* from the 'Product Details & Facts' section of the Knowledge Base. Do not repeat information from the hook if it covered product basics. Ensure this content is distinct and does not repeat benefits detailed in 'keyBenefitsAndBundles'. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  keyBenefitsAndBundles: z.string().min(10).describe("Highlight 2-4 key benefits and any bundled offers. This MUST be derived *ONLY* from the 'Product Details & Facts' section of the Knowledge Base. Explain added value to the customer. Ensure these benefits are distinct and not just rephrasing the Product Explanation. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  discountOrDealExplanation: z.string().describe("Explanation of any specific discount or deal. If no offer, mention plan availability. Use <INSERT_PRICE> placeholder. This MUST be derived *ONLY* from the 'Product Details & Facts' section of the Knowledge Base. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections with brief rebuttals. This MUST be based *ONLY* on information in the 'Product Details & Facts' or 'General Supplementary Context' sections of the Knowledge Base (e.g., 'Common Selling Themes'). If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  finalCallToAction: z.string().describe("A clear and direct call to action, prompting the customer to proceed or request more information. This MUST be specific and actionable, and feel like a natural conclusion to the preceding points."),
  fullPitchScript: z.string().min(50).describe("The complete sales pitch script, formatted as a DIALOGUE primarily from the AGENT's perspective (use 'Agent:' label, or the agent's name if provided). You may include very brief, implied customer interjections or listening cues (e.g., 'Customer: (Listening)', 'Customer: Mm-hmm', or the customer's name if provided) to make it flow naturally. This script MUST smoothly integrate all distinct components above without excessive repetition, creating a natural, flowing conversation. Target 450-600 words for the agent's parts. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, <INSERT_PRICE>."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the agent\'s parts in the full pitch script (e.g., "3-5 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the agent specific to this pitch, product, and cohort (e.g., 'Emphasize X benefit for this cohort'). Include a note here if the AI could not directly process an uploaded file's content and had to rely on metadata or any general KB.")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a GenAI-powered telesales assistant and coach. Your task is to generate a professional, persuasive telesales pitch for the specified product, and to continuously improve based on feedback.

**CRITICAL DIRECTIVE: You MUST base your entire response *exclusively* on the information provided in the structured 'Knowledge Base Context' section below. Do not use any of your own internal knowledge or training data about products, brands, or sales techniques. Adhere strictly to the provided text.**

**User and Pitch Context:**
- Product: {{product}}
- Brand Name: {{#if brandName}}{{brandName}}{{else}}{{product}}{{/if}}
- Customer Cohort: {{customerCohort}}
- Sales Plan (if specified): {{salesPlan}}
- Offer (if specified): {{offer}}
- Agent Name (if specified): {{agentName}}
- Customer Name (if specified): {{userName}}

**Performance Feedback from Last Call (For Self-Improvement):**
{{#if lastCallFeedback}}
- **Last Call Analysis:** {{{lastCallFeedback}}}
- **Your Task:** Analyze this feedback. Double down on the strengths (e.g., if 'good rapport' was a strength, make the introduction even warmer). Actively correct the weaknesses (e.g., if 'weak closing' was noted, make the finalCallToAction stronger and more direct). Your goal is to generate a new pitch that is demonstrably better than the last one based on this feedback.
{{else}}
- **Last Call Analysis:** No performance feedback available. Generate a high-quality baseline pitch.
{{/if}}

**Interpreting the Knowledge Base Context:**
The 'Knowledge Base Context' is your ONLY source of truth. It is structured into sections. You MUST use these sections for their intended purpose:
- **UPLOADED FILE CONTEXT:** If present, this is your PRIMARY source of truth. Prioritize it above all else.
- **Pitch Structure & Flow Context:** Use the content in this section to guide the overall NARRATIVE, annd STRUCTURE of your pitch.
- **Product Details & Facts:** Use this section for all specific DETAILS like product features, benefits, pricing, and rebuttal points.
- **General Supplementary Context:** Use this for any additional background information.
- If a section is sparse or missing, gracefully handle this in the relevant pitch component by stating details can be provided later. Do NOT invent information. State clearly in 'notesForAgent' that the KB was insufficient for certain parts.

**Knowledge Base Context (Your Sole Source of Information):**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Output Generation Rules & Pitch Structure (Strictly follow this):**
You MUST populate EVERY field in the 'GeneratePitchOutputSchema' based *only* on the context above, using the designated sections for their intended purpose.

1.  **pitchTitle**: A compelling title for the pitch.
2.  **warmIntroduction**: A brief, friendly opening.
3.  **personalizedHook**: A hook tailored to the customer cohort.
4.  **productExplanation**: Explain the product's core value proposition, sourcing details from the 'Product Details & Facts' section.
5.  **keyBenefitsAndBundles**: Highlight 2-4 key benefits and any bundles, sourcing details from the 'Product Details & Facts' section.
6.  **discountOrDealExplanation**: Explain the specific deal or plan availability. Use "<INSERT_PRICE>" for the price. Source from 'Product Details & Facts'.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections, using information from the 'Product Details & Facts' section.
8.  **finalCallToAction**: A clear, direct call to action.
9.  **fullPitchScript**: A complete dialogue integrating all components above. Use the 'Pitch Structure & Flow Context' to guide the overall narrative. Target 450-600 words. Use placeholders like {{agentName}}, {{userName}}, etc.
10. **estimatedDuration**: Estimate the speaking time for the agent's script.
11. **notesForAgent**: Provide notes for the agent. If the KB was insufficient, mention it here (e.g., "Note: The provided Knowledge Base lacked specific details on X, Y, Z. The pitch was generated based on the available information.").

**Tone:** Conversational, confident, respectful.
Generate the pitch.
`,
  model: 'googleai/gemini-1.5-flash-latest',
  config: { temperature: 0.4 },
});


const generatePitchFlow = ai.defineFlow(
  {
    name: 'generatePitchFlow',
    inputSchema: GeneratePitchInputSchema,
    outputSchema: GeneratePitchOutputSchema,
  },
  async (input: GeneratePitchInput): Promise<GeneratePitchOutput> => {
    const isUploadedFileContextPresent = input.knowledgeBaseContext.includes("--- START OF UPLOADED FILE CONTEXT (PRIMARY SOURCE) ---");
    const isGeneralKbEffectivelyEmpty = !isUploadedFileContextPresent && 
                                       (input.knowledgeBaseContext.includes("No specific knowledge base files or text entries were found") || 
                                        input.knowledgeBaseContext.trim().length < 150); 

    if (isGeneralKbEffectivelyEmpty && !isUploadedFileContextPresent) {
      const errorTitle = "Pitch Generation Failed - Insufficient Knowledge Base";
      const errorMessage = `The general Knowledge Base for '${input.product}' is too sparse or missing, and no direct file context was successfully provided to override it. The AI cannot generate a meaningful pitch without sufficient product details. Please update the general Knowledge Base or provide a valid direct context file.`;
      return {
        pitchTitle: errorTitle,
        warmIntroduction: errorMessage,
        personalizedHook: "(KB content insufficient to generate distinct content)",
        productExplanation: "(KB content insufficient to generate distinct content)",
        keyBenefitsAndBundles: "(KB content insufficient to generate distinct content)",
        discountOrDealExplanation: "(KB content insufficient to generate distinct content)",
        objectionHandlingPreviews: "(KB content insufficient to generate distinct content)",
        finalCallToAction: "(KB content insufficient to generate distinct content)",
        fullPitchScript: `Pitch generation aborted due to insufficient Knowledge Base content for product '${input.product}'. AI requires detailed KB to create a relevant pitch. ${errorMessage}`,
        estimatedDuration: "N/A",
        notesForAgent: "Knowledge Base needs to be populated for this product, or a richer direct context file must be provided, to enable effective pitch generation."
      };
    }
    
    const { output } = await generatePitchPrompt(input);

    if (!output || !output.fullPitchScript || output.fullPitchScript.length < 50) {
        console.error("generatePitchFlow: AI returned no or very short pitch script. Input context (truncated):", JSON.stringify({...input, knowledgeBaseContext: input.knowledgeBaseContext.substring(0,200) + "..."}, null, 2));
        throw new Error("AI failed to generate a complete pitch script. The response from the model was empty or too short.");
    }
    return output;
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
      personalizedHook: "(Invalid input prevented distinct content generation)",
      productExplanation: "(Invalid input prevented distinct content generation)",
      keyBenefitsAndBundles: "(Invalid input prevented distinct content generation)",
      discountOrDealExplanation: "(Invalid input prevented distinct content generation)",
      objectionHandlingPreviews: "(Invalid input prevented distinct content generation)",
      finalCallToAction: "(Invalid input prevented distinct content generation)",
      fullPitchScript: `Pitch generation aborted due to invalid input. Details: ${errorMessages}`,
      estimatedDuration: "N/A",
      notesForAgent: "Input validation failed. Check server console for details."
    };
  }
  try {
    return await generatePitchFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generatePitchFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    let clientErrorTitle = "Pitch Generation Failed - AI Error";
    let clientErrorMessage = `The AI model encountered an error and could not generate the pitch. Details: ${error.message || "An unknown error occurred"}.`;
    
    const lowerErrorMessage = error.message?.toLowerCase() || "";

    if (lowerErrorMessage.includes('429') || lowerErrorMessage.includes('quota')) {
        clientErrorTitle = "Pitch Generation Failed - API Quota Exceeded";
        clientErrorMessage = `You have exceeded your current API quota for the AI model(s). Please check your billing details or wait for the quota to reset. Original error: ${error.message}`;
    } else if (lowerErrorMessage.includes("api key") || lowerErrorMessage.includes("permission denied")) {
      clientErrorTitle = "Pitch Generation Failed - API Key/Permission Issue";
      clientErrorMessage = `There seems to be an issue with the API key or permissions for the AI models. Please check server logs and ensure the Google API Key is valid and has access to the Gemini models. Original error: ${error.message}`;
    } else if (lowerErrorMessage.includes("safety settings") || lowerErrorMessage.includes("blocked")) {
      clientErrorTitle = "Pitch Generation Failed - Content Safety";
      clientErrorMessage = `The pitch generation was blocked, likely due to content safety filters. The combination of your prompt and Knowledge Base content might have triggered this. Original error: ${error.message}`;
    } else if (lowerErrorMessage.includes("model returned no response") || lowerErrorMessage.includes("empty or too short")) {
      clientErrorTitle = "Pitch Generation Failed - No AI Response";
      clientErrorMessage = `The AI model did not return a valid response, or the response was empty/too short. This might be due to overly restrictive input or a temporary model issue. Original error: ${error.message}`;
    }

    return {
      pitchTitle: clientErrorTitle,
      warmIntroduction: clientErrorMessage, 
      personalizedHook: "(AI error prevented distinct content generation)",
      productExplanation: "(AI error prevented distinct content generation)",
      keyBenefitsAndBundles: "(AI error prevented distinct content generation)",
      discountOrDealExplanation: "(AI error prevented distinct content generation)",
      objectionHandlingPreviews: "(AI error prevented distinct content generation)",
      finalCallToAction: "(AI error prevented distinct content generation)",
      fullPitchScript: `Pitch generation failed due to an AI service error. Details: ${clientErrorMessage}. Please check server logs. Input context provided to AI may have caused issues.`,
      estimatedDuration: "N/A",
      notesForAgent: "AI service error during pitch generation. Check server logs and KB content quality for the selected product, or the content/format of any directly uploaded file."
    };
  }
}
