
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
import { PRODUCTS, ET_PLAN_CONFIGURATIONS, SALES_PLANS, CUSTOMER_COHORTS } from '@/types';


// Updated Schema to include agentName and userName
const GeneratePitchInputSchema = z.object({
  product: z.enum(PRODUCTS).describe('The product to pitch (ET or TOI).'),
  customerCohort: z.enum(CUSTOMER_COHORTS).describe('The customer cohort to target.'),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional().describe('The selected ET plan page configuration. Only applicable if product is ET.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content. This can include general KB entries and/or specific instructions and content from a directly uploaded file, which should be prioritized by the AI.'),
  salesPlan: z.enum(SALES_PLANS).optional().describe("The specific sales plan duration being pitched (e.g., '1-Year', 'Monthly')."),
  offer: z.string().optional().describe("Specific offer details for this pitch (e.g., '20% off', 'TimesPrime bundle included')."),
  agentName: z.string().optional().describe("The name of the sales agent delivering the pitch. To be used in the pitch script."),
  userName: z.string().optional().describe("The name of the customer receiving the pitch. To be used for personalization in the script."),
  brandName: z.string().optional().describe("The official brand name of the product (e.g., The Economic Times).")
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;


const GeneratePitchOutputSchema = z.object({
  pitchTitle: z.string().describe("A compelling title for the sales pitch."),
  warmIntroduction: z.string().describe("A brief, friendly opening, introducing the agent (if name provided) and the product brand. This MUST be concise and derived *ONLY* from Knowledge Base cues if available (e.g., standard greeting), otherwise general professional greeting. Ensure this content is distinct from other sections."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call and possibly hinting at benefits or offers relevant to that cohort. This section MUST use specifics *ONLY* from the Knowledge Base if available for the cohort or product, otherwise a generic professional hook for the cohort. Ensure this content is distinct and does not repeat Warm Introduction or Product Explanation points."),
  productExplanation: z.string().min(10).describe("Clear explanation of the product ({{{product}}}), focusing on its core value proposition to the customer. This MUST be derived *ONLY* from the 'Knowledge Base Context', prioritizing any 'UPLOADED FILE CONTEXT' section if present. Do not repeat information from the hook if it covered product basics. Ensure this content is distinct and does not repeat benefits detailed in 'keyBenefitsAndBundles'. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  keyBenefitsAndBundles: z.string().min(10).describe("Highlight 2-4 key benefits and any bundled offers. This MUST be derived *ONLY* from the 'Knowledge Base Context', prioritizing any 'UPLOADED FILE CONTEXT' section. Explain added value to the customer. Ensure these benefits are distinct and not just rephrasing the Product Explanation. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  discountOrDealExplanation: z.string().describe("Explanation of any specific discount or deal ({{{offer}}}, {{{salesPlan}}}). If no offer, mention plan availability. Use <INSERT_PRICE> placeholder. This MUST be derived *ONLY* from the 'Knowledge Base Context', prioritizing any 'UPLOADED FILE CONTEXT'. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections with brief rebuttals. This MUST be based *ONLY* on information in 'Knowledge Base Context' (e.g., 'Common Selling Themes'), prioritizing any 'UPLOADED FILE CONTEXT'. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  finalCallToAction: z.string().describe("A clear and direct call to action, prompting the customer to proceed or request more information. This MUST be specific and actionable, and feel like a natural conclusion to the preceding points."),
  fullPitchScript: z.string().min(50).describe("The complete sales pitch script, formatted as a DIALOGUE primarily from the AGENT's perspective (use 'Agent:' label, or '{{{agentName}}}:' if agentName is provided). You may include very brief, implied customer interjections or listening cues (e.g., 'Customer: (Listening)', 'Customer: Mm-hmm', or '{{{userName}}}: Okay.') to make it flow naturally, but the focus is on the agent's speech. This script MUST smoothly integrate all distinct components above without excessive repetition, creating a natural, flowing conversation. Target 450-600 words for the agent's parts. Use placeholders: {{AGENT_NAME}} for {{{agentName}}}, {{USER_NAME}} for {{{userName}}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, <INSERT_PRICE>."),
  estimatedDuration: z.string().describe('Estimated speaking duration of the agent\'s parts in the full pitch script (e.g., "3-5 minutes").'),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the agent specific to this pitch, product, and cohort (e.g., 'Emphasize X benefit for this cohort'). Include a note here if the AI could not directly process an uploaded file's content and had to rely on metadata or any general KB.")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;


const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a GenAI-powered telesales assistant trained to generate high-conversion sales pitches for {{{product}}}.
Your task is to generate a professional, persuasive telesales pitch.
Adhere strictly to the output schema and guidelines, populating ALL fields in 'GeneratePitchOutputSchema'. Each section must be sufficiently detailed and based on the provided context.

User and Pitch Context:
- Product: {{{product}}}
- Brand Name: {{#if brandName}}{{{brandName}}}{{else}}{{{product}}}{{/if}}
- Customer Cohort: {{{customerCohort}}}
- Sales Plan (if specified): {{{salesPlan}}}
- Offer (if specified): {{{offer}}}
- Agent Name (if specified, use for personalization): {{{agentName}}}
- Customer Name (if specified, use for personalization): {{{userName}}}
{{#if etPlanConfiguration}}
- ET Plan Configuration: {{{etPlanConfiguration}}}
{{/if}}

Interpreting the Knowledge Base Context:
The 'Knowledge Base Context' provided below is your PRIMARY source for product features, benefits, and specific details about {{{product}}}.
It may contain a special section marked: "--- START OF UPLOADED FILE CONTEXT (PRIMARY SOURCE) ---".

If this "UPLOADED FILE CONTEXT" section IS PRESENT:
1.  You MUST treat the information associated with the 'File Name' and 'File Type' in that section as the ABSOLUTE PRIMARY SOURCE for this pitch.
2.  Diligently follow the 'Instruction to AI' within that section. Attempt to extract pitch-worthy details (features, benefits, USPs, pricing if mentioned, target audience notes) directly from the described file or its provided text content.
3.  If the instruction indicates you should try to process the file but you cannot (e.g., due to file type limitations for non-text files where content wasn't pre-extracted), you MUST clearly state this in the 'notesForAgent' field (e.g., "Note: The specific content of the uploaded file '[File Name]' (type: [File Type]) could not be directly processed by the AI for this pitch. The pitch was generated based on the file's metadata and any general Knowledge Base content provided."). Then, proceed to generate the best possible pitch using the file's metadata (name, type) and any fallback general KB content.
4.  Content outside this "UPLOADED FILE CONTEXT" section (if any) should be treated as secondary or general supporting information.

If the "UPLOADED FILE CONTEXT" section is NOT present:
Then the entire 'Knowledge Base Context' should be treated as general information for {{{product}}}.

CRITICAL INSTRUCTION (General): Derive ALL product features, benefits, and specific details for EACH section of the pitch *only* from the provided Knowledge Base Context (always prioritizing the "UPLOADED FILE CONTEXT" section if it exists).
DO NOT invent or infer any features, benefits, pricing, or details NOT EXPLICITLY stated in the provided context.
If the context is insufficient to generate a specific pitch section, you must handle it gracefully by acting like a real salesperson. For instance, if you don't know a specific detail, say something like, "I can have the full details of that feature sent to you right after our call, but the key takeaway is..." and pivot to a known benefit. Do NOT break character by saying "I don't have information" or telling the user to "check the knowledge base."
AVOID REPETITION: Ensure that each section of the pitch (introduction, hook, product explanation, benefits etc.) brings NEW and DISTINCT information or perspectives based on the KB. Do not repeat the same points across different sections. Ensure a natural, logical flow without redundancy.

Output Generation Rules & Pitch Structure:
You MUST populate EVERY field in the 'GeneratePitchOutputSchema'.
1.  **pitchTitle**: Create a compelling title for this specific pitch (e.g., "Exclusive {{{product}}} Offer for {{{userName}}} from {{#if agentName}}{{{agentName}}}{{else}}us{{/if}}").
2.  **warmIntroduction**: A strong, polite opening. Start with a friendly greeting using the customer's name if provided (e.g., "Hello {{{userName}}},"). Introduce the agent by name and the company using the full Brand Name ("My name is {{{agentName}}} from {{#if brandName}}{{{brandName}}}{{else}}{{{product}}}{{/if}}."). This must be concise and professional.
3.  **personalizedHook**: This is critical. State the purpose of the call clearly and directly, tailored to the '{{customerCohort}}'. Examples:
    *   For 'Payment Drop-off': "I'm calling because I noticed you were in the middle of subscribing to {{#if brandName}}{{{brandName}}}{{else}}{{{product}}}{{/if}}, and I wanted to see if I could help you complete that process smoothly and ensure you get the offer you were looking at."
    *   For 'Expired Users': "I'm reaching out today because your {{#if brandName}}{{{brandName}}}{{else}}{{{product}}}{{/if}} subscription recently expired, and we have a special offer for returning readers I thought you'd be interested in."
    *   For 'New Prospect Outreach': "I'm calling to introduce you to {{#if brandName}}{{{brandName}}}{{else}}{{{product}}}{{/if}}, our premium service for leaders who need to stay ahead of market trends. I wanted to take just a couple of minutes to explain how it could benefit you."
    This section must be confident and clearly state the reason for the call.
4.  **productExplanation**: Concisely explain {{{product}}} focusing on its core value proposition using brand-specific benefit language derived *only* from the Knowledge Base Context (prioritizing uploaded file context). Focus on translating KB features into clear customer advantages relevant to "{{customerCohort}}". This should be distinct from benefits listed later and from the hook.
5.  **keyBenefitsAndBundles**: Highlight 2-4 key *benefits* of {{{product}}}, strictly from the Knowledge Base Context (prioritizing uploaded file context). Explain customer gains. These should be specific and distinct benefits not fully detailed in the product explanation. If bundles (e.g., TimesPrime) are in KB, explain their *added value* and specific benefits. Do not repeat benefits already sufficiently covered.
6.  **discountOrDealExplanation**: If "{{salesPlan}}" or "{{offer}}" are specified, explain the deal. Use "<INSERT_PRICE>" for price. If no plan/offer, mention attractive plans are available. This must be derived *only* from the Knowledge Base Context.
7.  **objectionHandlingPreviews**: Proactively address 1-2 common objections (e.g., cost, trust) with brief, benefit-oriented rebuttals based *only* on information in Knowledge Base Context (prioritizing uploaded file context, e.g., 'Common Selling Themes' if present). These should be concise previews and distinct from other sections.
8.  **finalCallToAction**: Conclude with a strong, clear, and direct call to action (e.g., "So, {{{userName}}}, would you like to subscribe now with this offer?" or "Shall I send a link for the offer, {{{userName}}}?"). Make this a natural conclusion.
9.  **fullPitchScript**: This is the main output. Format this as a DIALOGUE primarily from the AGENT's perspective.
    *   Use "{{#if agentName}}{{{agentName}}}{{else}}Agent{{/if}}:" as the speaker label for the agent's parts.
    *   You may include very brief, implied customer interjections using "{{#if userName}}{{{userName}}}{{else}}Customer{{/if}}:" (e.g., "{{#if userName}}{{{userName}}}{{else}}Customer{{/if}}: (Listening)", "{{#if userName}}{{{userName}}}{{else}}Customer{{/if}}: Okay...").
    *   The AGENT's dialogue should smoothly integrate ALL the detailed content from sections 2-8, ensuring each component contributes uniquely without undue repetition. The script should flow logically and naturally.
    *   The agent's total speaking part should be approximately 450-600 words.
    *   Use placeholders: {{AGENT_NAME}} (for {{{agentName}}}), {{USER_NAME}} (for {{{userName}}}), {{PRODUCT_NAME}} (for {{#if brandName}}{{{brandName}}}{{else}}{{{product}}}{{/if}}), {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, <INSERT_PRICE>.
10. **estimatedDuration**: Estimate speaking time for the AGENT's parts in 'fullPitchScript' (e.g., "3-5 minutes").
11. **notesForAgent** (Optional): 1-2 brief, actionable notes for the agent specific to this pitch, product, and cohort (e.g., "For 'Paywall Dropoff' cohort, emphasize exclusive content from KB."). If the AI could not process an uploaded file, include that note here as specified in "Interpreting the Knowledge Base Context" point 3.

Tone: Conversational, confident, respectful, helpful. Use simple English.
Generate the pitch.
`,
  model: 'googleai/gemini-1.5-flash-latest',
  config: {
    temperature: 0.4, // Slightly lower for more consistency and adherence to KB
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }
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
                                       (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || 
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

    try {
      const {output} = await generatePitchPrompt(input);
      if (!output || !output.fullPitchScript || output.fullPitchScript.length < 50) {
         console.error("generatePitchFlow: AI returned no or very short pitch script. Input context (truncated):", JSON.stringify({...input, knowledgeBaseContext: input.knowledgeBaseContext.substring(0,200) + "..."}, null, 2));
        throw new Error("AI failed to generate a complete pitch script. The response from the model was empty or too short.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generatePitchFlow (AI call):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error("Input to generatePitchFlow (KB context truncated):", JSON.stringify({...input, knowledgeBaseContext: input.knowledgeBaseContext.substring(0,200) + "..."}, null, 2));
      
      let clientErrorTitle = "Pitch Generation Failed - AI Error";
      let clientErrorMessage = `The AI model encountered an error and could not generate the pitch. Details: ${error.message}.`;

      if (error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("permission denied")) {
        clientErrorTitle = "Pitch Generation Failed - API Key/Permission Issue";
        clientErrorMessage = `There seems to be an issue with the API key or permissions for the AI model ('${generatePitchPrompt.name}'). Please check server logs and ensure the Google API Key is valid and has access to the Gemini models. Original error: ${error.message}`;
      } else if (error.message.toLowerCase().includes("safety settings") || error.message.toLowerCase().includes("blocked")) {
        clientErrorTitle = "Pitch Generation Failed - Content Safety";
        clientErrorMessage = `The pitch generation was blocked, likely due to content safety filters. The combination of your prompt and Knowledge Base content might have triggered this. Original error: ${error.message}`;
      } else if (error.message.toLowerCase().includes("model returned no response") || error.message.toLowerCase().includes("empty or too short")) {
        clientErrorTitle = "Pitch Generation Failed - No AI Response";
        clientErrorMessage = `The AI model did not return a valid response, or the response was empty/too short. This might be due to overly restrictive input or a temporary model issue. Original error: ${error.message}`;
      } else if (error.message.toLowerCase().includes("quota")) {
        clientErrorTitle = "Pitch Generation Failed - API Quota Exceeded";
        clientErrorMessage = `You have exceeded your current API quota for the AI model. Please check your billing details or wait for the quota to reset. Original error: ${error.message}`;
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
    console.error("Catastrophic error calling generatePitchFlow:", error);
     let clientErrorTitle = "Pitch Generation Error - Critical System Issue";
     let clientErrorMessage = `Pitch generation failed due to a critical system error: ${error.message.substring(0,250)}.`;
      if (error.message && (error.message.includes("GenkitInitError:") || error.message.toLowerCase().includes("api key not found") )) {
        clientErrorTitle = `Pitch Generation Failed: AI Service Initialization Error`;
        clientErrorMessage = `Please verify your GOOGLE_API_KEY in .env and check Google Cloud project settings. (Details: ${error.message})`;
    }
    return {
      pitchTitle: clientErrorTitle,
      warmIntroduction: clientErrorMessage,
      personalizedHook: "(System error prevented distinct content generation)",
      productExplanation: "(System error prevented distinct content generation)",
      keyBenefitsAndBundles: "(System error prevented distinct content generation)",
      discountOrDealExplanation: "(System error prevented distinct content generation)",
      objectionHandlingPreviews: "(System error prevented distinct content generation)",
      finalCallToAction: "(System error prevented distinct content generation)",
      fullPitchScript: `Pitch generation critically failed. Details: ${clientErrorMessage}`,
      estimatedDuration: "N/A",
      notesForAgent: "Critical system error during pitch generation. Check server logs."
    };
  }
}
