
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'zod';
import { PRODUCTS } from '@/types'; 

const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the customer is objecting to.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the sole source for rebuttal generation.')
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection. It should be well-structured, empathetic, and directly address the customer\'s concern. Prioritize using KB information. If KB is sparse for the specific objection, use general knowledge to structure a helpful response while still grounding it in the product context. Can be detailed if necessary.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;

const promptTemplate = `You are a GenAI-powered telesales assistant trained to provide quick, convincing rebuttals for objections related to {{{product}}} subscriptions.
Your task is to provide a professional, specific, and effective response to the customer's objection.

Customer's Objection: "{{{objection}}}"

Product: {{{product}}}

Knowledge Base Context for '{{{product}}}' (Your PRIMARY source for rebuttal points):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Instructions for Rebuttal Generation:
1.  **Understand the Core Objection:** First, deeply analyze the customer's statement "{{{objection}}}" to understand the underlying concern or reason for their hesitation. Is it about price, value, trust, timing, a past experience, or a misunderstanding of the product?

2.  **Prioritize Knowledge Base (KB) Content:**
    *   **Direct Hit:** Thoroughly search the 'Knowledge Base Context'. Look for 1-2 highly relevant facts, features, user benefits, testimonials, or 'Common Selling Themes' that directly address or reframe the *specific underlying concern* you identified in step 1. If the KB provides a clear counter or relevant information, this MUST form the core of your rebuttal.
    *   **Synthesize KB Info:** Do NOT just list facts from the KB. *Synthesize* this information into a compelling argument. Explain the *benefit* or *value* this KB point offers in relation to their objection. Show how the KB fact directly addresses or mitigates the customer's specific concern.
        *   *Example of Transforming KB info:* If the objection is "It's too expensive," and the KB mentions "Exclusive market reports save users hours of research," your rebuttal could be: "I understand budget is a key factor. Many of our subscribers find that the exclusive market reports included with {{{product}}} save them significant research time, which itself has a monetary value. For instance, if you save even a few hours a month, that value can quickly offset the subscription cost. Does that perspective on time-saving help address your concern about the price?"

3.  **Structure the Rebuttal (ABBC/Q - Acknowledge, Bridge, Benefit, Clarify/Question):**
    *   **Acknowledge:** Start with an empathetic acknowledgment of the customer’s concern (e.g., "I understand your concern about that...", "That's a fair point to consider...", "I can see why you might feel that way...").
    *   **Bridge & Benefit (from KB if possible):** Smoothly transition to the most relevant point(s) you've synthesized from the Knowledge Base. Clearly explain the *benefit* or *value* this KB point offers.
    *   **Handling Sparse KB / Unclear Objections:**
        *   If the Knowledge Base genuinely lacks a direct counter for the *specific* objection, OR if the objection itself is very vague:
            *   Still acknowledge the objection empathetically.
            *   You may then use your general conversational AI capabilities to help structure a polite and logical response.
            *   Attempt to pivot to a general strength or key benefit of '{{{product}}}' (from the KB, if available, even if not a direct counter).
            *   Crucially, *ask clarifying questions* to better understand the customer's concern or to guide them towards relevant product aspects. Example: "I understand your point about [objection]. While our current information doesn't specifically detail [that exact scenario], I can share that {{{product}}} is highly valued for [general key benefit from KB if any, e.g., 'its comprehensive coverage of X sector']. To make sure I'm addressing your concern correctly, could you tell me a bit more about what aspects are most important to you?"
            *   Do NOT invent product features or specific details not in the KB.
    *   **Detail Level & Length:** The length of your rebuttal should be proportionate to the complexity of the objection and the richness of relevant information in the KB. If a short, impactful answer is sufficient (especially if KB provides it), use that. However, if the objection is nuanced and the KB offers substantial counter-points (or if clarification is needed), provide a more *detailed and comprehensive rebuttal* to fully address the customer's concern and build a strong case. Aim for a natural conversational flow.
    *   **Clarify/Question (Recommended):** End with a gentle, open-ended question to encourage dialogue or confirm understanding (e.g., "Does that perspective on value help address your concern about the price?", "What are your thoughts on this aspect?", "How does that sound as a way to look at it?").

4.  **Impact and Clarity:** Ensure the rebuttal is impactful and easy to understand, regardless of length. Focus on addressing the customer's concern directly and persuasively using synthesized KB facts. Avoid generic statements. The more specific your rebuttal is to the objection *and* the product's KB information, the better.

5.  **Tone:** Maintain a confident, helpful, professional, and understanding tone. Avoid being defensive or dismissive.

6.  **Strict KB Adherence (for product facts):**
    *   All specific product facts, features, and benefits MUST be based *exclusively* on information found in the provided 'Knowledge Base Context'.
    *   Do NOT invent product information or make assumptions beyond the KB.

Provide only the rebuttal text in the 'rebuttal' field. Ensure it is a well-structured and complete response.
`;

const generateRebuttalFlow = ai.defineFlow(
  {
    name: 'generateRebuttalFlow',
    inputSchema: GenerateRebuttalInputSchema,
    outputSchema: GenerateRebuttalOutputSchema,
  },
  async (input : GenerateRebuttalInput) : Promise<GenerateRebuttalOutput> => {
    if (input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      return {
        rebuttal: "Cannot generate rebuttal: No relevant knowledge base content was found for the selected product. Please add information to the Knowledge Base for this product to enable rebuttal generation."
      };
    }
    
    const primaryModel = 'googleai/gemini-2.0-flash';
    const fallbackModel = 'googleai/gemini-1.5-flash-latest';
    let output;

    try {
      console.log(`Attempting rebuttal generation with primary model: ${primaryModel}`);
       const { output: primaryOutput } = await ai.generate({
          prompt: promptTemplate,
          model: primaryModel,
          input,
          output: { schema: GenerateRebuttalOutputSchema },
          config: { temperature: 0.4 },
      });
      output = primaryOutput;

    } catch (e: any) {
        if (e.message.includes('429') || e.message.toLowerCase().includes('quota')) {
            console.warn(`Primary model (${primaryModel}) failed due to quota. Attempting fallback to ${fallbackModel}.`);
             const { output: fallbackOutput } = await ai.generate({
                prompt: promptTemplate,
                model: fallbackModel,
                input,
                output: { schema: GenerateRebuttalOutputSchema },
                config: { temperature: 0.4 },
            });
            output = fallbackOutput;
        } else {
            throw e;
        }
    }


    if (!output || !output.rebuttal || output.rebuttal.trim().length < 10) { 
      console.error("generateRebuttalFlow: Prompt returned no or very short rebuttal. Input was:", JSON.stringify(input, null, 2));
      let fallbackMessage = "I'm sorry, I couldn't generate a specific rebuttal for that objection based on the current knowledge. ";
      if (input.knowledgeBaseContext.length < 100) { 
          fallbackMessage += "The available information for this product might be too limited. ";
      }
      fallbackMessage += "Could you rephrase your concern, or can I highlight some of the product's general benefits?";
      return { rebuttal: fallbackMessage };
    }
    return output;
  }
);

export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  try {
    return await generateRebuttalFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generateRebuttalFlow:", error);
    let specificMessage = `Rebuttal Generation Failed due to a server-side error: ${error.message}.`;
    if (error.message.includes('429') || error.message.toLowerCase().includes('quota')) {
        specificMessage = `API Quota Exceeded for all available AI models. Please check your billing details or wait for the quota to reset. Error: ${error.message}`;
    } else if (error.message && (error.message.includes("GenkitInitError:") || error.message.toLowerCase().includes("api key not found") )) {
        specificMessage = `Rebuttal Generation Failed: AI Service Initialization Error. Please verify your GOOGLE_API_KEY in .env and check Google Cloud project settings. (Details: ${error.message})`;
    }
    return {
      rebuttal: `Critical Error: ${specificMessage} Check server logs and Knowledge Base for '${input.product}'.`
    };
  }
}
