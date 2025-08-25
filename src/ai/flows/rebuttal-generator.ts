
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * Now includes a deterministic, non-AI fallback algorithm to generate a rebuttal if the AI service fails.
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


/**
 * A non-AI, rule-based fallback for generating rebuttals.
 * This is triggered if the primary AI service fails.
 */
function generateFallbackRebuttal(input: GenerateRebuttalInput): GenerateRebuttalOutput {
    console.warn("Executing non-AI fallback for rebuttal generation.");
    const { objection, knowledgeBaseContext } = input;
    const lowerObjection = objection.toLowerCase();

    // 1. Keyword analysis
    const keywords = {
        price: ['price', 'expensive', 'cost', 'costly', 'budget'],
        time: ['time', 'busy', 'later'],
        value: ['free', 'useful', 'value', 'benefit', 'already get'],
    };

    let matchedCategory: 'price' | 'time' | 'value' | 'general' = 'general';
    if (keywords.price.some(kw => lowerObjection.includes(kw))) matchedCategory = 'price';
    else if (keywords.time.some(kw => lowerObjection.includes(kw))) matchedCategory = 'time';
    else if (keywords.value.some(kw => lowerObjection.includes(kw))) matchedCategory = 'value';

    // 2. Find a relevant snippet from the Knowledge Base
    let relevantSnippet = "";
    const sentences = knowledgeBaseContext.split(/[.!?]/).filter(s => s.trim().length > 10);
    const searchTerms = {
        price: ['value', 'save', 'worth', 'benefit'],
        time: ['quick', 'save time', 'efficient', 'summary'],
        value: ['exclusive', 'ad-free', 'in-depth', 'analysis', 'reports'],
        general: ['benefit', 'feature', 'value']
    };

    for (const term of searchTerms[matchedCategory]) {
        const foundSentence = sentences.find(s => s.toLowerCase().includes(term));
        if (foundSentence) {
            relevantSnippet = foundSentence.trim() + ".";
            break;
        }
    }
    if (!relevantSnippet && sentences.length > 0) {
      relevantSnippet = sentences[0].trim() + "."; // Fallback to first sentence
    }

    // 3. Generate response from template
    let rebuttalText = "";
    switch (matchedCategory) {
        case 'price':
            rebuttalText = `I understand that price is an important consideration. Many of our subscribers find that the value they receive makes it a worthwhile investment. For example, ${relevantSnippet || 'the exclusive content helps them make better-informed decisions.'} Does that perspective on its value help?`;
            break;
        case 'time':
            rebuttalText = `I can certainly appreciate that you're busy. That's actually why many of our users find this valuable. For instance, ${relevantSnippet || 'it helps them stay updated on critical news efficiently.'} It's designed to save you time in the long run. Would a more efficient way to stay informed be helpful?`;
            break;
        case 'value':
            rebuttalText = `That's a fair point. While there is a lot of free information available, what our subscribers pay for is a different level of insight and experience. For example, ${relevantSnippet || 'the content is curated by experts to provide deeper analysis.'} This helps you get past the noise. What are your thoughts on that?`;
            break;
        default: // General
            rebuttalText = `I understand where you're coming from. A key aspect of this service is that ${relevantSnippet || 'it provides unique benefits.'} Could you tell me a little more about what you're looking for, so I can see if it's a good fit?`;
            break;
    }

    return {
        rebuttal: `[Backup Response] ${rebuttalText}`
    };
}


const generateRebuttalFlow = ai.defineFlow(
  {
    name: 'generateRebuttalFlow',
    inputSchema: GenerateRebuttalInputSchema,
    outputSchema: GenerateRebuttalOutputSchema,
  },
  async (input : GenerateRebuttalInput) : Promise<GenerateRebuttalOutput> => {
    // Step 1: Pre-validation of input
    if (!input.knowledgeBaseContext || input.knowledgeBaseContext.trim() === "" || input.knowledgeBaseContext.startsWith("No specific knowledge base content found")) {
      return generateFallbackRebuttal(input);
    }
    
    // Step 2: Try primary AI model
    try {
        const { output } = await generateRebuttalPrompt(input);
        if (!output || !output.rebuttal || output.rebuttal.trim().length < 10) {
            throw new Error("Primary AI model returned an insufficient response.");
        }
        return output;
    } catch (primaryError: any) {
      console.warn("Primary AI model for rebuttal failed. Error:", primaryError.message);
      
      // Step 3: Try fallback AI model
      try {
        console.log("Attempting rebuttal generation with fallback model.");
        const { output: fallbackOutput } = await ai.generate({
            prompt: generateRebuttalPrompt.prompt, 
            model: 'googleai/gemini-1.5-flash-latest', // Different, often more available model
            input,
            output: { schema: GenerateRebuttalOutputSchema, format: 'json' },
            config: { temperature: 0.5 },
        });

        if (!fallbackOutput || !fallbackOutput.rebuttal || fallbackOutput.rebuttal.trim().length < 10) {
            throw new Error("Fallback AI model also returned an insufficient response.");
        }
        return fallbackOutput;
      } catch (fallbackError: any) {
        console.error("Fallback AI model for rebuttal also failed. Error:", fallbackError.message);
        // Step 4: If all AI fails, use the deterministic, non-AI fallback
        return generateFallbackRebuttal(input);
      }
    }
  }
);


export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  try {
    const parseResult = GenerateRebuttalInputSchema.safeParse(input);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      // Even validation errors can use the fallback for a graceful response
      return generateFallbackRebuttal({
        ...input,
        objection: `(Input error prevented processing: ${errorMessages}) ${input.objection}`
      });
    }
    
    return await generateRebuttalFlow(parseResult.data);
  } catch (e: any) {
    const error = e as Error;
    console.error("Catastrophic error in generateRebuttal exported function:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    // Final failsafe, trigger the non-AI backup
    return generateFallbackRebuttal(input);
  }
}

