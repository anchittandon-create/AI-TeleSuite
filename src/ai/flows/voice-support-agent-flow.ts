
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Support Agent conversation.
 * Uses a conversational router to provide dynamic responses based on the Knowledge Base.
 * It uses other flows like speech synthesis.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  VoiceSupportAgentFlowInput,
  VoiceSupportAgentFlowOutput,
  VoiceSupportAgentFlowInputSchema,
  VoiceSupportAgentFlowOutputSchema,
  SynthesizeSpeechOutput,
} from '@/types';
import { synthesizeSpeech } from './speech-synthesis-flow';


const generateSupportResponsePrompt = ai.definePrompt(
  {
    name: 'generateSupportResponsePrompt',
    input: { schema: z.object({
        product: z.string(),
        userName: z.string().optional(),
        userQuery: z.string(),
        knowledgeBaseContext: z.string(),
    }) },
    output: { schema: z.object({
        responseText: z.string().min(1).describe("The AI's direct, helpful, and polite answer to the user's query. Start by addressing the user if their name is known (e.g., 'Hello {{userName}}, ...'). Be comprehensive but concise."),
        requiresLiveDataFetch: z.boolean().optional().describe("True if the query implies needing live, personal account data not typically in a static KB (e.g., specific expiry dates, invoice details for *this* user, password resets)."),
        sourceMention: z.string().optional().describe("Primary source of information (e.g., 'Knowledge Base', 'General Product Knowledge', 'Simulated Account Check')."),
        isUnanswerableFromKB: z.boolean().optional().describe("True if the Knowledge Base does not contain information to answer the query AND it's not a query requiring live personal data.")
    }) },
    prompt: `You are a highly skilled, empathetic, and professional AI Customer Support Agent for {{{product}}}.
Your primary goal is to answer the user's query accurately and helpfully based *only* on the provided Knowledge Base.
If the user's name is known, start with a polite "Hello {{{userName}}}, regarding your query about...". If their name is unknown, a simple "Regarding your query..." is appropriate.

User's Query: "{{{userQuery}}}"

Knowledge Base Context for {{{product}}} (Your PRIMARY Source of Truth):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Critical Instructions for Response Generation:**

1.  **Analyze User Query:** Carefully understand the intent behind "{{{userQuery}}}". Is it a question about features, pricing, account status, a problem, or something else? If the question requires a detailed explanation, provide one. If it's a simple question, a shorter response is fine.

2.  **Prioritize Knowledge Base (KB):**
    *   **Direct Answer:** If the 'Knowledge Base Context' **directly and clearly** provides the information to answer the user's query:
        *   Formulate your response using this information. Be natural and conversational.
        *   Set sourceMention to 'Knowledge Base'.
        *   Set isUnanswerableFromKB to false.
    *   **Indirect/Partial Answer from KB:** If the KB provides related information but not a direct answer:
        *   Share the relevant KB information.
        *   Clearly state if the KB doesn't fully address the query.
        *   Set sourceMention to 'Knowledge Base (Partial)'.
        *   Set isUnanswerableFromKB to true if a full answer isn't possible from KB alone.

3.  **Handling Queries Requiring Live/Personal Account Data:**
    *   If the query asks for information **specific to the user's personal account and NOT typically found in a static Knowledge Base** (e.g., "When is MY plan expiring?", "Where is MY invoice?", "What is MY current data usage?", "Can you reset MY password?", "Check MY subscription status"):
        *   You MUST politely state that for such specific account information, you would normally need to access their live account details, which you are simulating or cannot do directly in this interaction.
        *   Set requiresLiveDataFetch to true.
        *   Set sourceMention to 'Personal Account Data (Simulated Access Required)'.
        *   **CRITICAL: DO NOT invent or guess any specific user data, dates, personal details, or account numbers.**
        *   If the Knowledge Base provides *general guidance* on how users can typically find such information themselves (e.g., "Invoices are usually available in your account section on our website under 'Billing History'."), then provide this general guidance.
        *   Example: "Hello {{{userName}}}, for specific details like your plan's expiry date, I would typically need to check your live account information. Generally, you can find this by logging into your account on our website under the 'My Subscriptions' section. Would you like help finding that on the website?"
        *   Set isUnanswerableFromKB to true (as the KB itself doesn't hold *their* specific data).

4.  **Handling Queries Not in Knowledge Base (and not personal data):**
    *   If the Knowledge Base does **not** contain information to answer a general query (and it's not about live personal data):
        *   Politely state that the provided Knowledge Base does not have specific information on that exact query.
        *   Set sourceMention to 'General Product Knowledge (KB Limited)'.
        *   Set isUnanswerableFromKB to true.
        *   Offer general help about {{{product}}} if appropriate, based on the overall context of the KB if possible.
        *   Suggest rephrasing the query or ask if they'd like to be connected to a human agent for further assistance.
        *   Example: "Hello {{{userName}}}, I've checked our Knowledge Base for {{{product}}}, but I couldn't find specific details on your query about [topic of query]. I can tell you that {{{product}}} is generally known for [mention a broad feature from KB if any]. Would you like to try rephrasing your question, or shall I see about connecting you with a team member who might have more information?"

5.  **Response Style:**
    *   **Clarity and Conciseness:** Provide clear, direct, and easy-to-understand answers.
    *   **Professional Tone:** Maintain a helpful, empathetic, and professional tone throughout.
    *   **Completeness:** Ensure your responseText is a full and complete answer, addressing the user directly.
    *   **Structure:** If explaining steps or multiple points, use bullet points or clear paragraph breaks in responseText.

Based *strictly* on the user's query and the provided Knowledge Base Context, generate the responseText, determine requiresLiveDataFetch, isUnanswerableFromKB, and set sourceMention.
The responseText should be ready to be "spoken" to the user.
`,
    model: 'googleai/gemini-1.5-flash-latest',
    config: { temperature: 0.3 }
  },
);


export const runVoiceSupportAgentQuery = ai.defineFlow(
  {
    name: 'runVoiceSupportAgentQuery',
    inputSchema: VoiceSupportAgentFlowInputSchema,
    outputSchema: VoiceSupportAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSupportAgentFlowOutput> => {
    let aiResponseText = "";
    let aiSpeech: SynthesizeSpeechOutput | undefined;
    let escalationSuggested = false;
    let sourcesUsed: string[] = [];
    let flowErrorMessage: string | undefined = undefined;

    try {
      if (flowInput.knowledgeBaseContext.startsWith("No specific knowledge base content found")) {
         sourcesUsed.push("Limited Knowledge Base");
         console.warn("VoiceSupportAgentFlow: KB context is limited or missing for product:", flowInput.product);
      }

      const promptInput = {
          product: flowInput.product,
          userName: flowInput.userName,
          userQuery: flowInput.userQuery,
          knowledgeBaseContext: flowInput.knowledgeBaseContext,
      };
      const { output: promptResponse } = await generateSupportResponsePrompt(promptInput);

      if (!promptResponse || !promptResponse.responseText) {
        throw new Error("AI failed to generate a support response text. The response from the model was empty or invalid.");
      }
      aiResponseText = promptResponse.responseText;

      if (promptResponse.sourceMention) {
          sourcesUsed.push(promptResponse.sourceMention);
      }

      if (promptResponse.requiresLiveDataFetch) {
          if (!aiResponseText.toLowerCase().includes("escalate") && !aiResponseText.toLowerCase().includes("human support") && !aiResponseText.toLowerCase().includes("team member")) {
              aiResponseText += `\n\nSince this requires accessing your specific account details, would you like me to help you connect with a human support agent for further assistance?`;
          }
          escalationSuggested = true;
      } else if (promptResponse.isUnanswerableFromKB) {
          if (!aiResponseText.toLowerCase().includes("escalate") && !aiResponseText.toLowerCase().includes("human support") && !aiResponseText.toLowerCase().includes("team member")) {
          aiResponseText += `\n\nIf this doesn't fully answer your question, I can connect you with a team member for more specialized help. Would you like that?`;
          }
          escalationSuggested = true;
      }
      
      aiSpeech = await synthesizeSpeech({
        textToSpeak: aiResponseText,
        voiceProfileId: flowInput.voiceProfileId
      });

    } catch (error: any) {
      console.error("Error in VoiceSupportAgentFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      flowErrorMessage = (error.message || "An unexpected error occurred in the support agent flow.");
      aiResponseText = `I'm sorry, ${flowInput.userName || 'there'}, I encountered an issue trying to process your request: "${(error.message || "Internal Error").substring(0,100)}...". Please try again later, or I can try to connect you with a human agent.`;
      aiSpeech = await synthesizeSpeech({textToSpeak: aiResponseText, voiceProfileId: flowInput.voiceProfileId});
      escalationSuggested = true;
    }

    return {
      aiResponseText,
      aiSpeech,
      escalationSuggested,
      sourcesUsed: sourcesUsed.length > 0 ? [...new Set(sourcesUsed)] : undefined,
      errorMessage: flowErrorMessage,
    };
  }
);
