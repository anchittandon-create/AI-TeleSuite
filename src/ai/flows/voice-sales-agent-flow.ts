
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This is a simplified flow that generates a direct AI response to a user message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const voiceSalesAgentFlow = ai.defineFlow(
  {
    name: 'voiceSalesAgentFlow',
    inputSchema: z.object({
      userMessage: z.string(),
      product: z.string(),
      agentName: z.string(),
    }),
    outputSchema: z.object({
      responseText: z.string(),
    }),
  },
  async ({ userMessage, product, agentName }) => {
    console.log(`🧠 Incoming user message: "${userMessage}" for product: ${product}`);

    const agentPrompt = `
You are ${agentName || 'Anchit'}, an AI voice agent from The Economic Times. You're speaking to a potential subscriber about the '${product}' product.
Engage warmly and informatively. The user just said: "${userMessage}".
Respond like a human sales representative, and always include at least one value proposition for '${product}'.`;

    const aiResponse = await ai.generate({
      model: 'gemini-1.5-pro-latest',
      prompt: agentPrompt,
      config: {
        temperature: 0.7,
      }
    });

    let finalText = aiResponse.text?.trim();

    if (!finalText || finalText.length < 3) {
      console.warn('⚠️ AI returned empty or invalid text, using fallback.');
      finalText = 'I’m sorry, could you please repeat that? I didn’t catch it clearly.';
    }

    console.log('✅ Valid AI response:', finalText);
    return {
      responseText: finalText,
    };
  }
);

// This wrapper is not actually used by the reverted page, but is kept for consistency
// with the simplified flow's original design. The page directly calls the more complex
// runVoiceSalesAgentTurn which is now deprecated but was part of the original UI logic.
// For a future simplification, the page would call this.
export async function runVoiceSalesAgent(input: {
    userMessage: string;
    product: string;
    agentName?: string;
}): Promise<{ responseText: string }> {
    return await voiceSalesAgentFlow(input);
}
