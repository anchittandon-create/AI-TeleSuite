
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { PRODUCTS } from '@/types'; 

const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.enum(PRODUCTS).describe('The product (ET or TOI) the customer is objecting to.'),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the sole source for rebuttal generation.')
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection, derived exclusively from the Knowledge Base.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;

const generateRebuttalPrompt = ai.definePrompt({
  name: 'generateRebuttalPrompt',
  input: {schema: GenerateRebuttalInputSchema},
  output: {schema: GenerateRebuttalOutputSchema},
  prompt: `You are a GenAI-powered telesales assistant trained to provide quick, convincing rebuttals for objections related to {{{product}}} subscriptions.
Your task is to provide a professional, specific, and effective response to the customer's objection, leveraging the provided Knowledge Base.

Customer's Objection: "{{{objection}}}"

Product: {{{product}}}

Knowledge Base Context for '{{{product}}}' (Your ONLY source for rebuttal points):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Instructions for Rebuttal Generation:
1.  **Understand the Core Objection:** First, deeply analyze the customer's statement "{{{objection}}}" to understand the underlying concern or reason for their hesitation. Is it about price, value, trust, timing, a past experience, or a misunderstanding of the product?
2.  **Strategic KB Search:** Thoroughly search the 'Knowledge Base Context'. Look for 1-2 highly relevant facts, features, user benefits, testimonials, or 'Common Selling Themes' (like Value for Money, Productivity Boost, Exclusivity) that directly address or reframe the *specific underlying concern* you identified in step 1. Do NOT pick generic points.
3.  **Craft the Rebuttal - Acknowledge, Bridge, Benefit, Question (ABBC/Q):**
    *   **Acknowledge:** Start with an empathetic acknowledgment of the customer’s concern (e.g., "I understand your concern about that...", "That's a fair point to consider...").
    *   **Bridge & Benefit:** Smoothly transition to the most relevant point(s) from the Knowledge Base. Clearly explain the *benefit* or *value* this KB point offers in relation to their objection. For example, if the objection is "It's too expensive," and the KB mentions "Daily stock recommendations," you might bridge with: "I understand budget is a key factor. However, many of our subscribers find that the value from just one or two successful stock recommendations, which are part of our daily insights, can easily outweigh the subscription cost for the entire year."
    *   **Question (Optional but Recommended):** If appropriate, end with a gentle, open-ended question to encourage dialogue or clarify their concern further (e.g., "Does that perspective on value help address your concern about the price?", "Could you tell me a bit more about what makes you feel it's not the right time?").
4.  **Conciseness and Impact:** Keep the core rebuttal (Bridge & Benefit part) concise, ideally 2-4 sentences. It should be impactful and easy to understand.
5.  **Tone:** Maintain a confident, helpful, professional, and understanding tone. Avoid being defensive, dismissive, or argumentative.
6.  **Strict KB Adherence:**
    *   Your rebuttal MUST be based *exclusively* on information found in the provided 'Knowledge Base Context'.
    *   If the Knowledge Base genuinely lacks a direct counter for the *specific* objection, acknowledge the objection honestly. Then, try to pivot to a general strength or key benefit of '{{{product}}}' (from the KB) that might still be relevant, and follow up with a clarifying question. Example: "I understand your point about [objection]. While our current information doesn't specifically detail [that exact scenario], I can share that {{{product}}} is highly valued for [key benefit from KB]. Perhaps if you could tell me more about [aspect of objection], I could provide more relevant information?"
    *   Do NOT invent information or make assumptions beyond the KB.

Common Objections (for context, your response should address the *actual* "{{{objection}}}"):
- "It’s too expensive"
- "I’ll think about it" / "Send me details on WhatsApp"
- "I don’t have time right now" / "Maybe later"
- "Didn’t find it useful earlier" / "I get news for free anyway"

Provide only the rebuttal text in the 'rebuttal' field.
`,
  model: 'googleai/gemini-2.0-flash',
  config: {
    temperature: 0.4, // Slightly lower for more grounded, KB-focused responses
  }
});

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
    try {
      const {output} = await generateRebuttalPrompt(input);
      if (!output || !output.rebuttal || output.rebuttal.trim() === "") {
        console.error("generateRebuttalFlow: Prompt returned no or empty rebuttal. Input was:", JSON.stringify(input, null, 2));
        return { rebuttal: "I'm sorry, I couldn't generate a specific rebuttal for that objection based on the current knowledge. Could you rephrase, or can I help with another aspect related to its general benefits?"};
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generateRebuttalFlow:", error, "Input was:", JSON.stringify(input, null, 2));
       if (error.message && (error.message.includes("GenkitInitError:") || error.message.toLowerCase().includes("api key"))) {
        return {
          rebuttal: `Rebuttal Generation Aborted: AI Service Initialization Error. ${error.message}. Please verify your GOOGLE_API_KEY and Google Cloud project settings. (Details from server logs)`
        };
      }
      return {
        rebuttal: `Error generating rebuttal: ${error.message}. Ensure relevant Knowledge Base content exists for '${input.product}' and that the API Key is valid.`
      };
    }
  }
);

export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  try {
    return await generateRebuttalFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generateRebuttalFlow:", error);
    let specificMessage = `Rebuttal Generation Failed due to a server-side error: ${error.message}.`;
    if (error.message && (error.message.includes("GenkitInitError:") || error.message.toLowerCase().includes("api key not found") )) {
        specificMessage = `Rebuttal Generation Failed: AI Service Initialization Error. Please verify your GOOGLE_API_KEY in .env and check Google Cloud project settings. (Details: ${error.message})`;
    }
    return {
      rebuttal: `Critical Error: ${specificMessage} Check server logs and Knowledge Base for '${input.product}'.`
    };
  }
}

