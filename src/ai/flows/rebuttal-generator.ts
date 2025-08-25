
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'zod';
import { Product } from '@/types'; 

const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.nativeEnum(Product).describe('The product (ET or TOI) the customer is objecting to.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the sole source for rebuttal generation.')
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection. It should be well-structured, empathetic, and directly address the customer\'s concern. Prioritize using KB information. If KB is sparse for the specific objection, use general knowledge to structure a helpful response while still grounding it in the product context. Can be detailed if necessary.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;


const generateRebuttalPrompt = ai.definePrompt({
    name: 'generateRebuttalPrompt',
    input: { schema: GenerateRebuttalInputSchema },
    output: { schema: GenerateRebuttalOutputSchema },
    prompt: `You are a GenAI-powered telesales assistant trained to provide quick, convincing rebuttals for objections related to {{{product}}} subscriptions.
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
`,
    model: 'googleai/gemini-2.0-flash', // Primary model
    config: { temperature: 0.4 },
});


const generateRebuttalFlow = ai.defineFlow(
  {
    name: 'generateRebuttalFlow',
    inputSchema: GenerateRebuttalInputSchema,
    outputSchema: GenerateRebuttalOutputSchema,
  },
  async (input : GenerateRebuttalInput) : Promise<GenerateRebuttalOutput> => {
    // Step 1: Pre-validation of input
    if (!input.knowledgeBaseContext || input.knowledgeBaseContext === "No specific knowledge base content found for this product." || input.knowledgeBaseContext.trim() === "") {
      // Return a structured, user-friendly error instead of throwing.
      return {
        rebuttal: "Cannot generate rebuttal: The Knowledge Base for the selected product is empty or missing. Please add relevant documents or text entries to the Knowledge Base first."
      };
    }
    
    // Step 2: Call the defined prompt, which encapsulates the AI model call.
    const { output } = await generateRebuttalPrompt(input);

    // Step 3: Post-validation of the AI's output
    if (!output || !output.rebuttal || output.rebuttal.trim().length < 10) { 
      // If the AI returns an empty or insufficient response, throw a specific error to be caught by the outer handler.
      console.error("generateRebuttalFlow: AI returned an empty or insufficient response. Input was:", JSON.stringify(input, null, 2));
      throw new Error("The AI model returned an empty or insufficient response. This might be due to a temporary service issue or overly restrictive input context.");
    }
    
    // Step 4: Return the valid output
    return output;
  }
);


export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  // Final, all-encompassing try...catch block to ensure the feature never crashes.
  try {
    // The main flow now handles its own input validation and can be called directly.
    return await generateRebuttalFlow(input);
  } catch (e: any) {
    const error = e as Error;
    // Log the full error for server-side debugging.
    console.error("Catastrophic error in generateRebuttal exported function:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Determine a user-friendly error message.
    let specificMessage = `The AI service failed to generate a rebuttal. Details: ${error.message || "An unknown error occurred."}`;
    const lowerErrorMessage = error.message?.toLowerCase() || "";

    if (lowerErrorMessage.includes('429') || lowerErrorMessage.includes('quota')) {
        specificMessage = `The AI service is currently busy or the API quota has been exceeded. Please try again in a few moments. (Error: ${error.message})`;
    } else if (lowerErrorMessage.includes("api key") || lowerErrorMessage.includes("permission denied")) {
        specificMessage = `There is an authentication issue with the AI service. Please check the server's API Key or Service Account configuration. (Error: ${error.message})`;
    } else if (lowerErrorMessage.includes("safety settings") || lowerErrorMessage.includes("blocked")) {
        specificMessage = `The rebuttal generation was blocked by content safety filters. Please review the customer objection and Knowledge Base content for potentially sensitive terms. (Error: ${error.message})`;
    } else if (lowerErrorMessage.includes("model returned no response") || lowerErrorMessage.includes("empty or insufficient")) {
        specificMessage = `The AI model did not return a valid response, which can happen with very unusual inputs or temporary service issues. Please try rephrasing the objection. (Error: ${error.message})`;
    }
    
    // Return a structured error that the UI can display gracefully.
    return {
      rebuttal: `[Critical Error] ${specificMessage}`
    };
  }
}
