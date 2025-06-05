
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
Your task is to provide a professional and effective response to the customer's objection.

Customer's Objection: "{{{objection}}}"

Product: {{{product}}}

Knowledge Base Context for '{{{product}}}' (Your ONLY source for rebuttal points):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Instructions for Rebuttal Generation:
1.  **Acknowledge:** Always acknowledge the customer’s concern first (e.g., "I understand your concern about that...", "That's a fair point...").
2.  **Reframe:** Reframe the objection by presenting a key value, reassurance, or insight derived *exclusively* from the provided 'Knowledge Base Context'. Look for relevant benefits or 'Common Selling Themes' (like Value for Money, Productivity Boost) within the Knowledge Base to counter the objection.
3.  **Keep it Short & Natural:** The response should be concise, sound natural, and be professional.
4.  **Close Politely:** Close with a polite invitation to proceed or assist (e.g., "Does that help clarify things?", "Would you be open to considering that?", "Can I offer any more information?").

Common Objections (for context, your response should address the *actual* "{{{objection}}}"):
Be prepared to handle common objections like:
- "It’s too expensive"
- "I’ll think about it"
- "Send me the details on WhatsApp"
- "I don’t have time right now"
- "Maybe later"
- "Didn’t find it useful earlier"
- "I get news for free anyway"

Tone Guidelines:
- Empathetic, calm, and value-driven.
- Never argue, pressure, or exaggerate.
- Always aim to guide the user toward clarity and confidence.

Knowledge Base Adherence:
- Your rebuttal MUST be based *exclusively* on the provided 'Knowledge Base Context'.
- If the Knowledge Base is insufficient to address the specific objection, clearly state that (e.g., "I understand your point. While my current information doesn't directly cover that, I can highlight that {{{product}}} offers [mention a key benefit from KB]..."). Do NOT invent information.

Provide only the rebuttal text in the 'rebuttal' field.
`,
  model: 'googleai/gemini-2.0-flash'
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
        // Consider if a more specific error is needed if AI returns empty but not null
        return { rebuttal: "I'm sorry, I couldn't generate a specific rebuttal for that objection based on the current knowledge. Could you rephrase, or can I help with another aspect?"};
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

