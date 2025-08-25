
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * Now includes a deterministic, non-AI fallback algorithm to generate a high-quality rebuttal if the AI service fails.
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
    prompt: `You are a world-class sales coach and linguist, specializing in crafting perfect rebuttals for telesales agents selling {{{product}}} subscriptions. Your responses must be of the absolute highest quality: crystal-clear, empathetic, strategic, and concise.

**Customer's Objection:** "{{{objection}}}"

**Knowledge Base Context for '{{{product}}}':**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Your Task & Reasoning Process (Chain of Thought - Internal Monologue):**
Before generating the final rebuttal, you MUST perform this internal analysis:
1.  **Analyze & Categorize Objection:** What is the ROOT of the user's objection? Categorize it.
    *   *Price/Budget:* (e.g., "too expensive", "no money")
    *   *Value/Need:* (e.g., "get it for free", "don't need it", "not useful")
    *   *Time:* (e.g., "no time to use", "too busy")
    *   *Trust/Past Experience:* (e.g., "tried it before", "don't trust it")
    *   *Stall/Indecision:* (e.g., "send me details", "I'll think about it")
2.  **Extract Relevant KB Facts:** Based on the category, scan the Knowledge Base and extract the 1-2 MOST relevant facts or benefits that directly counter the objection. Do not pick generic points.
3.  **Formulate Strategy:** How will you use these facts to reframe the objection? Your strategy must be to show understanding and then pivot to the value proposition that makes the objection less relevant.

**Final Rebuttal Generation (Adhere to this Quality Rubric):**

1.  **Strict Word Limit (Non-Negotiable):** The final output **MUST NOT exceed 100 words**. Be concise and powerful.
2.  **Mandatory Structure (ABBC/Q - Acknowledge, Bridge, Benefit, Clarify/Question):**
    *   **(A) Acknowledge:** ALWAYS start with an empathetic acknowledgment of their point. (e.g., "I completely understand that...", "That's a very fair point..."). This builds trust.
    *   **(B) Bridge:** Smoothly transition from their concern to your point. (e.g., "...and that's exactly why so many of our subscribers find value in...", "...what many users appreciate in that situation is...").
    *   **(B) Benefit (from KB):** Present the single most impactful counter-point from the KB as a direct benefit to them. (e.g., "...the exclusive reports often help them save time worth much more than the subscription cost."). This is your core argument.
    *   **(C/Q) Clarify/Question:** End with a soft, open-ended question to re-engage them. (e.g., "Does that way of looking at the value resonate with you?", "Perhaps that might help with the time issue?").
3.  **Tone & Language:**
    *   **Empathetic & Confident:** Sound like you are on their side but are confident in the product's value.
    *   **No Jargon:** Use simple, crystal-clear language.
    *   **No Dismissiveness:** NEVER say "But...", "Actually...", or directly contradict them. Reframe, don't argue.

Generate the final 'rebuttal' field based on your analysis and this strict rubric.
`,
    model: 'googleai/gemini-1.5-flash-latest',
    config: { temperature: 0.3 },
});


/**
 * A non-AI, rule-based fallback for generating rebuttals.
 * This is triggered if the primary AI service fails.
 * It is designed to be concise and high-quality.
 */
function generateFallbackRebuttal(input: GenerateRebuttalInput): GenerateRebuttalOutput {
    console.warn("Executing non-AI fallback for rebuttal generation.");
    const { objection, knowledgeBaseContext } = input;
    const lowerObjection = objection.toLowerCase();

    // 1. Keyword analysis
    const keywords = {
        price: ['price', 'expensive', 'cost', 'costly', 'budget', 'money'],
        time: ['time', 'busy', 'later', 'schedule'],
        value: ['free', 'useful', 'value', 'benefit', 'already get', 'don\'t need'],
        trust: ['tried before', 'experience', 'trust'],
    };

    let matchedCategory: 'price' | 'time' | 'value' | 'trust' | 'general' = 'general';
    if (keywords.price.some(kw => lowerObjection.includes(kw))) matchedCategory = 'price';
    else if (keywords.time.some(kw => lowerObjection.includes(kw))) matchedCategory = 'time';
    else if (keywords.value.some(kw => lowerObjection.includes(kw))) matchedCategory = 'value';
    else if (keywords.trust.some(kw => lowerObjection.includes(kw))) matchedCategory = 'trust';


    // 2. Find a relevant snippet from the Knowledge Base
    let relevantSnippet = "";
    const sentences = knowledgeBaseContext.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 15);
    const searchTerms = {
        price: ['value', 'save', 'worth', 'benefit', 'exclusive', 'investment'],
        time: ['quick', 'save time', 'efficient', 'summary', 'briefing'],
        value: ['exclusive', 'ad-free', 'in-depth', 'analysis', 'reports', 'unbiased'],
        trust: ['trusted', 'expert', 'reliable', 'in-depth'],
        general: ['benefit', 'feature', 'value', 'exclusive', 'insight']
    };

    if(sentences.length > 0) {
        for (const term of searchTerms[matchedCategory]) {
            const foundSentence = sentences.find(s => s.toLowerCase().includes(term));
            if (foundSentence) {
                // Get a concise, relevant part of the sentence.
                relevantSnippet = foundSentence.substring(0, 150).split(',')[0] + '.';
                break;
            }
        }
        if (!relevantSnippet) {
          relevantSnippet = sentences[0].substring(0, 150) + "..."; // Fallback to first sentence if no keyword match
        }
    }

    // 3. Generate response from high-quality templates (max 100 words)
    let rebuttalText = "";
    switch (matchedCategory) {
        case 'price':
            rebuttalText = `I completely understand that price is an important factor. That's why many subscribers feel the service provides excellent value. For instance, ${relevantSnippet || 'the exclusive insights can help in making informed decisions that far outweigh the cost.'} Would you be open to exploring how it might fit your budget?`;
            break;
        case 'time':
            rebuttalText = `I can certainly appreciate how busy you are, and that's exactly why this service is so helpful. It's designed to give you the most important insights efficiently. For example, ${relevantSnippet || 'you get curated briefings that save you valuable time.'} This way, you stay informed without the noise.`;
            break;
        case 'value':
            rebuttalText = `That's a fair point, there is a lot of free information out there. What our members value is the trusted, in-depth analysis without the clutter. For example, ${relevantSnippet || 'you get exclusive, expert-led content.'} This helps you focus on what truly matters.`;
            break;
        case 'trust':
            rebuttalText = `I understand your hesitation based on past experiences. We are always working to improve our service for our members. The focus is on providing ${relevantSnippet || 'deeply researched and reliable content from trusted experts.'} Perhaps we could briefly discuss what would make it more valuable for you now?`;
            break;
        default: // General or Stall
            rebuttalText = `I understand. Just so I can provide the most relevant information, could you tell me a little more about your main priority right now? Many find that ${relevantSnippet || 'the exclusive analysis here is a key benefit.'} This helps me see if it's even a good fit for you.`;
            break;
    }
    
    // Final check to ensure it doesn't exceed the limit due to a long snippet.
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
    
    if (!input.knowledgeBaseContext || input.knowledgeBaseContext.trim().length < 50 || input.knowledgeBaseContext.startsWith("No specific knowledge base content found")) {
      console.warn("Rebuttal generation using fallback due to insufficient Knowledge Base.");
      // Use the failsafe if KB is clearly empty or missing.
      return generateFallbackRebuttal(input);
    }
    
    // AI First approach
    try {
        const { output } = await generateRebuttalPrompt(input);
        
        if (!output || !output.rebuttal || output.rebuttal.trim().length < 10) {
            throw new Error("Primary AI model returned an insufficient or empty response.");
        }
        
        // Final length check as a safeguard.
        if (output.rebuttal.split(/\s+/).length > 100) {
          console.warn("AI response exceeded 100 words, truncating.");
          output.rebuttal = output.rebuttal.split(/\s+/).slice(0, 99).join(' ') + '...';
        }
        return output;
    } catch (primaryError: any) {
      console.error("Rebuttal generation by AI failed:", primaryError.message);
      // If any AI error occurs, immediately use the deterministic, non-AI fallback.
      return generateFallbackRebuttal(input);
    }
  }
);


export async function generateRebuttal(input: GenerateRebuttalInput): Promise<GenerateRebuttalOutput> {
  try {
    const parseResult = GenerateRebuttalInputSchema.safeParse(input);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      console.error("Invalid input for generateRebuttal:", errorMessages);
      // Even validation errors can use the fallback for a graceful response
      return generateFallbackRebuttal({
        ...input,
        objection: `(System input error) ${input.objection}`
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
