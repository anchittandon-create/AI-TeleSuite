
'use server';
/**
 * @fileOverview Rebuttal Generator AI agent. Uses Knowledge Base content.
 * Now includes a deterministic, non-AI fallback algorithm to generate a high-quality rebuttal if the AI service fails.
 * - generateRebuttal - A function that handles the rebuttal generation process.
 * - GenerateRebuttalInput - The input type for the generateRebuttal function.
 * - GenerateRebuttalOutput - The return type for the generateRebuttal function.
 */

import {ai} from '@/ai/genkit';
import { GenerateRebuttalInputSchema, GenerateRebuttalOutputSchema } from '@/types';
import type { GenerateRebuttalInput, GenerateRebuttalOutput } from '@/types';


const generateRebuttalPrompt = ai.definePrompt({
    name: 'generateRebuttalPrompt',
    input: { schema: GenerateRebuttalInputSchema },
    output: { schema: GenerateRebuttalOutputSchema },
    prompt: `You are a world-class sales coach and linguist, specializing in crafting perfect rebuttals for telesales agents selling {{{product}}} subscriptions. Your responses must be of the absolute highest quality: crystal-clear, empathetic, strategic, and self-explanatory based on the context.

**Customer's Objection:** "{{{objection}}}"

**CRITICAL: Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context' section below. If a 'USER-SELECTED KB CONTEXT' section is present, it is your PRIMARY and ONLY source of truth. If the provided Knowledge Base is insufficient, you are authorized to supplement your response by browsing the official product website ({{{brandUrl}}}) and its sub-pages to find accurate information. Do NOT invent facts.**

**Knowledge Base Context for '{{{product}}}' (Your ONLY source of truth):**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Your Task & Reasoning Process (Chain of Thought - Internal Monologue):**
Before generating the final rebuttal, you MUST perform this internal analysis:
1.  **Analyze & Categorize Objection:** What is the ROOT of the user's objection? Is it about price, value, time, trust, or something else?
2.  **Extract Relevant KB Facts:** Based on the category, scan the Knowledge Base and extract the 1-3 MOST relevant facts or benefits that directly counter the objection. If a 'USER-SELECTED KB CONTEXT' section is present, prioritize facts from there. If KB is insufficient, find relevant information on the official website.
3.  **Formulate Strategy:** How will you use these facts to reframe the objection? Your strategy must be to show understanding and then pivot to the value proposition that makes the objection less relevant.

**Final Rebuttal Generation (Adhere to this Quality Rubric):**

1.  **Adaptive Length (CRITICAL):** The length and detail of your response should adapt to the situation.
    *   If the objection is simple (e.g., "I'm busy") and/or the Knowledge Base is sparse, provide a **concise and brief** rebuttal (2-3 sentences) focused on re-engaging.
    *   If the objection is complex or detailed, and the Knowledge Base offers rich, relevant information, provide a **more detailed, self-explanatory rebuttal** (4-5 sentences). Explain the 'why' behind your points, using the KB context to build a stronger, more persuasive case.
2.  **Mandatory Structure (ABBC/Q - Acknowledge, Bridge, Benefit, Clarify/Question):**
    *   **(A) Acknowledge:** ALWAYS start with an empathetic acknowledgment of their point. (e.g., "I completely understand that...", "That's a very fair point...").
    *   **(B) Bridge:** Smoothly transition from their concern to your point. (e.g., "...and that's exactly why so many of our subscribers find value in...", "...what many users appreciate in that situation is...").
    *   **(B) Benefit (from KB/Website):** Present the most impactful counter-point(s) as a direct benefit to them. This is your core argument. Be as detailed as necessary to be persuasive.
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
 * This is triggered if the primary AI service fails or if the KB is empty.
 */
function generateFallbackRebuttal(input: GenerateRebuttalInput): GenerateRebuttalOutput {
    console.warn("Executing non-AI fallback for rebuttal generation.");
    const { objection, knowledgeBaseContext } = input;
    const lowerObjection = objection.toLowerCase();

    // 1. Keyword analysis to categorize the objection
    const keywords = {
        price: ['price', 'expensive', 'cost', 'costly', 'budget', 'money'],
        time: ['time', 'busy', 'later', 'schedule'],
        value: ['free', 'useful', 'value', 'benefit', 'already get', 'don\\'t need'],
        trust: ['tried before', 'experience', 'trust'],
    };

    let matchedCategory: 'price' | 'time' | 'value' | 'trust' | 'general' = 'general';
    if (keywords.price.some(kw => lowerObjection.includes(kw))) matchedCategory = 'price';
    else if (keywords.time.some(kw => lowerObjection.includes(kw))) matchedCategory = 'time';
    else if (keywords.value.some(kw => lowerObjection.includes(kw))) matchedCategory = 'value';
    else if (keywords.trust.some(kw => lowerObjection.includes(kw))) matchedCategory = 'trust';


    // 2. Find a relevant snippet from the Knowledge Base context
    let relevantSnippet = "";
    if (knowledgeBaseContext && !knowledgeBaseContext.includes("No specific knowledge base")) {
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
    
    // Final check to ensure it doesn't exceed a reasonable word count.
    const words = rebuttalText.split(/\\s+/);
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
    
    if (!input.knowledgeBaseContext || input.knowledgeBaseContext.trim().length < 50 || input.knowledgeBaseContext.includes("No specific knowledge base content found")) {
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
