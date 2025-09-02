
'use server';

/**
 * @fileOverview Generates a sales pitch using an AI model, guided by Knowledge Base content and input parameters.
 * - generatePitch - A function that handles the sales pitch generation.
 * - GeneratePitchInput - The input type for the generatePitch function.
 * - GeneratePitchOutput - The return type for the generatePitch function.
 */

import {ai} from '@/ai/genkit';
import { GeneratePitchInputSchema, GeneratePitchOutputSchema } from '@/types';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/types';

const generatePitchPrompt = ai.definePrompt({
  name: 'generatePitchPrompt',
  input: {schema: GeneratePitchInputSchema},
  output: {schema: GeneratePitchOutputSchema},
  prompt: `You are a world-class sales agent. Your goal is to be empathetic, persuasive, and clear, using the provided KB to drive conversion. Your responses must be of the absolute highest quality.

**CRITICAL DIRECTIVE: You MUST base your entire response *exclusively* on the information provided in the structured 'Knowledge Base Context' section below. Adhere strictly to the provided text and structure. Your primary goal is to be truthful to the knowledge base and persuasive.**

**Clarity and Simplicity Mandate:** The generated pitch must be **crystal clear and easily understandable** for a customer on a phone call. Use simple language, short sentences, and a logical flow. Avoid jargon, complex terms, or overly corporate phrasing. The goal is persuasion through clarity.

**User and Pitch Context:**
- Product: {{product}}
- Brand Name: {{#if brandName}}{{brandName}}{{else}}{{product}}{{/if}}
- Customer Cohort: {{customerCohort}}
- Sales Plan (if specified): {{salesPlan}}
- Offer (if specified): {{offer}}
- Agent Name (if specified): {{agentName}}
- Customer Name (if specified): {{userName}}

{{#if optimizationContext}}
**Optimization Insights (from previous call analysis):**
You MUST use these insights to refine the pitch. Lean into the strengths and address the weaknesses.
\`\`\`
{{{optimizationContext}}}
\`\`\`
{{/if}}

**Knowledge Base Context (Your Sole Source of Information):**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Output Generation Rules & Pitch Structure (Strictly follow this):**

You MUST populate EVERY field in the 'GeneratePitchOutputSchema' based *only* on the context above, using the designated sections for their intended purpose.

- **pitchTitle**: A compelling title for the pitch.
- **warmIntroduction**: A brief, friendly opening. Introduce the agent (using "{{agentName}}" if provided, otherwise "your agent") and the brand ("{{brandName}}"). This section **MUST** include a clear **statement of purpose for the call**, derived from the \`--- PITCH STRUCTURE & FLOW CONTEXT ---\` section of the Knowledge Base.
- **personalizedHook**: A hook tailored to the customer cohort, expanding on the reason for the call.
- **productExplanation**: Explain the product's core value proposition. **Source this information *only* from the \`--- PRODUCT DETAILS & FACTS ---\` section of the Knowledge Base.** Do not repeat information from the introduction or hook.
- **keyBenefitsAndBundles**: Highlight 2-4 key benefits and any bundles. **Source this information *only* from the \`--- PRODUCT DETAILS & FACTS ---\` section of the Knowledge Base.**
- **discountOrDealExplanation**: Explain the specific deal or plan availability. Use "<INSERT_PRICE>" for the price. **Source this information *only* from the \`--- PRODUCT DETAILS & FACTS ---\` section of the Knowledge Base.**
- **objectionHandlingPreviews**: Proactively address 1-2 common objections. **Source this information *only* from the \`--- PRODUCT DETAILS & FACTS ---\` or \`--- GENERAL SUPPLEMENTARY CONTEXT ---\` sections of the Knowledge Base.**
- **finalCallToAction**: A clear, direct call to action that closes with a clear CTA.
- **fullPitchScript**: A complete dialogue integrating all components above. Use the \`--- PITCH STRUCTURE & FLOW CONTEXT ---\` to guide the overall narrative. Target 450-600 words. Use placeholders like {{agentName}}, {{userName}}, etc.
- **estimatedDuration**: Estimate the speaking time for the agent's script.
- **notesForAgent**: Provide notes for the agent. If the KB was insufficient, mention it here (e.g., "Note: The provided Knowledge Base lacked specific details on X, Y, Z. The pitch was generated based on the available information.").

**Tone:** Elite, concise sales script grounded in KB; empathetic and persuasive.
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
                                       (input.knowledgeBaseContext.includes("No specific knowledge base content found") || 
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

    