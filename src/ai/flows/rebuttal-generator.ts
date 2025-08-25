
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
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection. It should be well-structured, empathetic, and directly address the customer\'s concern, not exceeding 100 words. Prioritize using KB information. If KB is sparse for the specific objection, use general knowledge to structure a helpful response while still grounding it in the product context.'),
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

**CRITICAL INSTRUCTIONS FOR REBUTTAL GENERATION:**

1.  **Strict Word Limit:** Your entire generated rebuttal **MUST NOT exceed 100 words**. This is the most important rule. Be concise and impactful.

2.  **Analyze the Core Objection:** Deeply analyze the customer's statement "{{{objection}}}" to understand the underlying concern (price, value, timing, etc.).

3.  **Prioritize Knowledge Base (KB) Content:**
    *   Search the 'Knowledge Base Context' for 1-2 highly relevant facts or benefits that directly counter the identified concern.
    *   Synthesize this information into a compelling argument. Do not just list facts.

4.  **Structure the Rebuttal (ABBC/Q - Acknowledge, Bridge, Benefit, Clarify/Question):**
    *   **Acknowledge:** Start with an empathetic acknowledgment of the customer’s concern (e.g., "I understand your concern...").
    *   **Bridge & Benefit (from KB if possible):** Smoothly transition to the most relevant point(s) from the Knowledge Base. Clearly explain the benefit.
    *   **Handling Sparse KB:** If the KB lacks a direct counter, acknowledge the objection, pivot to a general strength of '{{{product}}}' from the KB, and ask a clarifying question. Do NOT invent product information.
    *   **Question (Recommended):** End with a gentle, open-ended question to encourage dialogue (e.g., "Does that perspective help address your concern?").

5.  **Strict KB Adherence (for product facts):**
    *   All specific product facts, features, and benefits MUST be based *exclusively* on information found in the provided 'Knowledge Base Context'.

Provide only the rebuttal text in the 'rebuttal' field. Ensure it is a well-structured and complete response adhering to the 100-word limit.
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
            // Truncate the snippet to keep the overall rebuttal short
            relevantSnippet = foundSentence.trim().substring(0, 150) + (foundSentence.length > 150 ? "..." : ".");
            break;
        }
    }
    if (!relevantSnippet && sentences.length > 0) {
      relevantSnippet = sentences[0].trim().substring(0, 150) + (sentences[0].length > 150 ? "..." : "."); // Fallback to first sentence
    }

    // 3. Generate response from template (ensure they are concise)
    let rebuttalText = "";
    switch (matchedCategory) {
        case 'price':
            rebuttalText = `I understand that price is an important consideration. Many subscribers find great value in it. For example, ${relevantSnippet || 'the exclusive content helps them make better-informed decisions.'} Does that perspective on its value help?`;
            break;
        case 'time':
            rebuttalText = `I can certainly appreciate that you're busy. That's why many users find this so helpful, as it's designed to save you time. For instance, ${relevantSnippet || 'it helps them stay updated on critical news efficiently.'}`;
            break;
        case 'value':
            rebuttalText = `That's a fair point. While free information is available, our subscribers value a different level of insight. For example, ${relevantSnippet || 'the content is curated by experts to provide deeper analysis.'} What are your thoughts on that?`;
            break;
        default: // General
            rebuttalText = `I understand where you're coming from. A key aspect of this service is that ${relevantSnippet || 'it provides unique benefits.'} To ensure I'm addressing your concern correctly, could you tell me a bit more about what you're looking for?`;
            break;
    }
    
    // Final check to ensure it doesn't exceed the limit due to a long snippet
    const words = rebuttalText.split(/\s+/);
    if (words.length > 100) {
        rebuttalText = words.slice(0, 99).join(' ') + '...';
    }


    return {
        rebuttal: rebuttalText
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
