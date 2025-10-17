
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Support Agent conversation.
 * This flow determines the correct text response based on a user query and knowledge base.
 * It does NOT handle speech synthesis.
 */

import { ai } from '@/ai/genkit';
import { AI_MODELS } from '@/ai/config/models';
import { VoiceSupportAgentFlowInputSchema, VoiceSupportAgentFlowOutputSchema } from '@/types';
import type { VoiceSupportAgentFlowInput, VoiceSupportAgentFlowOutput } from '@/types';


const generateSupportResponsePrompt = ai.definePrompt(
  {
    name: 'generateSupportResponsePrompt',
    input: { schema: VoiceSupportAgentFlowInputSchema },
    output: { schema: VoiceSupportAgentFlowOutputSchema },
    prompt: `You are a clear, factual, step-by-step support agent for {{{product}}}. Your name is {{{agentName}}}.
Your primary goal is to provide crisp, factual support answers grounded in the provided Knowledge Base.
If the user's name is known, start by addressing them politely (e.g., "Hello {{{userName}}}, regarding your query about...").

**CRITICAL DIRECTIVE: You MUST base your entire response *exclusively* on the information provided in the structured 'Knowledge Base Context' section below. If the provided Knowledge Base is insufficient, you are authorized to supplement your response by browsing the official product website ({{{brandUrl}}}) and its sub-pages to find accurate information. Your primary goal is to be truthful to the knowledge base and helpful.**

**KNOWLEDGE BASE USAGE RULES (NON-NEGOTIABLE):**
1.  For any factual content about the product, including features, troubleshooting steps, and policies, you MUST exclusively use content from the Knowledge Base.
2.  If a category of document is missing or the KB does not contain an answer, you must state that and suggest escalation.
3.  Never invent information. If the KB doesn't provide a detail, do not mention it.

User's Query: "{{{userQuery}}}"
Conversation History so far: {{{conversationHistory}}}

Knowledge Base Context for {{{product}}} (Your ONLY Source of Truth):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Critical Instructions for Response Generation:**

1.  **Analyze User Query & History:** Carefully understand the intent behind "{{{userQuery}}}" in the context of the conversation history. Is it a new question, a follow-up, or a clarification?

2.  **Prioritize Knowledge Base (KB):**
    *   **Direct Answer:** If the 'Knowledge Base Context' **directly and clearly** provides the information to answer the user's query, formulate a comprehensive and natural response using this information.
    *   **Indirect Answer:** If the KB provides related information but not a direct answer, share the relevant KB information and politely explain how it might help, or use it to ask a clarifying question.
    
3.  **Handling Queries Requiring Live/Personal Account Data:**
    *   If the query asks for information **specific to the user's personal account and NOT typically found in a static Knowledge Base** (e.g., "When is MY plan expiring?", "Where is MY invoice?", "Can you reset MY password?"):
        *   Politely state that for such specific account information, they would need to speak with a human agent who can securely access their account.
        *   Set **requiresLiveDataFetch** to **true**.
        *   **CRITICAL: DO NOT invent or guess any specific user data, dates, or personal details.**
        *   If the KB provides *general guidance* (e.g., "Invoices are in your account section on our website"), provide this.
        *   Example: "For specific details like your plan's expiry date, I'll need to connect you with one of our human agents who can securely access your account details. Would you like me to do that?"
        
4.  **Handling Queries Not in Knowledge Base (and not personal data):**
    *   If the Knowledge Base does **not** contain information to answer a general query:
        *   Politely state that you couldn't find specific information on that exact query in your available resources.
        *   Set **isUnanswerableFromKB** to **true**.
        *   Offer to connect them to a human agent for more specialized help.
        *   Example: "I've checked our resources for {{{product}}}, but I couldn't find specific details on your query about [topic]. I can connect you with a team member who might have more information. Would you like that?"

5.  **Response Style:**
    *   **Be Conversational:** Don't just state facts. Weave them into a helpful, polite, and natural conversation.
    *   **Be Comprehensive:** If a question requires a detailed explanation, provide one. Use bullet points for clarity if explaining steps.
    *   **Professional Tone:** Maintain a helpful, empathetic, and professional tone throughout.
    *   **Forbidden Phrases:** Never use phrases like "should I use the knowledge base", "do you want me to check the KB", or "I cannot access the KB unless you allow". Access is automatic.

Based *strictly* on the user's query, history, and the provided Knowledge Base Context, generate the responseText.
The responseText should be ready to be "spoken" to the user.
`,
    model: AI_MODELS.MULTIMODAL_PRIMARY,
    config: { temperature: 0.3 }
  },
);


const runVoiceSupportAgentQueryFlow = ai.defineFlow(
  {
    name: 'runVoiceSupportAgentQuery',
    inputSchema: VoiceSupportAgentFlowInputSchema,
    outputSchema: VoiceSupportAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSupportAgentFlowOutput> => {
    let aiResponseText = "";
    let escalationSuggested = false;
    let sourcesUsed: string[] = [];
    
    try {
      if (flowInput.knowledgeBaseContext.startsWith("No specific knowledge base content found")) {
         sourcesUsed.push("Limited Knowledge Base");
         console.warn("VoiceSupportAgentFlow: KB context is limited or missing for product:", flowInput.product);
      }

      const { output: promptResponse } = await generateSupportResponsePrompt(flowInput);

      if (!promptResponse || !promptResponse.responseText) {
        throw new Error("AI failed to generate a support response text. The response from the model was empty or invalid.");
      }
      aiResponseText = promptResponse.responseText;

      if (promptResponse.requiresLiveDataFetch || promptResponse.isUnanswerableFromKB) {
          if (!aiResponseText.toLowerCase().includes("human") && !aiResponseText.toLowerCase().includes("team member") && !aiResponseText.toLowerCase().includes("connect you")) {
              aiResponseText += `\n\nWould you like me to connect you with a team member for further assistance with this?`;
          }
          escalationSuggested = true;
      }

      return {
        aiResponseText,
        escalationSuggested,
        sourcesUsed: sourcesUsed.length > 0 ? [...new Set(sourcesUsed)] : undefined,
      };
      
    } catch (error: any) {
      console.error("Error in VoiceSupportAgentFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      const flowErrorMessage = (error.message || "An unexpected error occurred in the support agent flow.");
      
      const userFacingErrorMessage = `I'm sorry, ${flowInput.userName || 'there'}, I encountered an issue trying to process your request: "${(error.message || "Internal Error").substring(0,100)}...". Please try again later, or I can try to connect you with a human agent.`;
      
      return {
        aiResponseText: userFacingErrorMessage,
        escalationSuggested: true,
        errorMessage: flowErrorMessage,
      };
    }
  }
);

export async function runVoiceSupportAgentQuery(flowInput: VoiceSupportAgentFlowInput): Promise<VoiceSupportAgentFlowOutput> {
  return runVoiceSupportAgentQueryFlow(flowInput);
}
