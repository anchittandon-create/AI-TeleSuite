
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This is a simplified flow that generates a direct AI response to a user message.
 */

import { defineFlow } from 'genkit/flow';
import { ai } from '@genkit-ai/ai';

export const voiceSalesAgentFlow = defineFlow(
  {
    name: 'voiceSalesAgentFlow',
    inputSchema: {
      userMessage: 'string',
      product: 'string',
      agentName: 'string',
    },
    outputSchema: {
      responseText: 'string',
    },
  },
  async ({ userMessage, product, agentName }) => {
    console.log(`🧠 Incoming user message: "${userMessage}" for product: ${product}`);

    const agentPrompt = `
You are ${agentName || 'Anchit'}, an AI voice agent from The Economic Times. You're speaking to a potential subscriber about the '${product}' product.
Engage warmly and informatively. The user just said: "${userMessage}".
Respond like a human sales representative, and always include at least one value proposition for '${product}'.`;

    const aiResponse = await ai.generate({
      model: 'googleai/gemini-1.5-pro-latest',
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

// Wrapper for type safety and easier calling from the frontend
export async function runVoiceSalesAgent(input: {
    userMessage: string;
    product: string;
    agentName?: string;
}): Promise<{ responseText: string }> {
    return await voiceSalesAgentFlow(input);
}
