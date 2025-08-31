
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, generating the AI's TEXT response.
 * Speech synthesis is handled by the client. This version ensures the Knowledge Base
 * is used on every conversational turn.
 */

import { ai } from '@/ai/genkit';
import {
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  ConversationTurn
} from '@/types';
import type { VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput, GeneratePitchOutput } from '@/types';
import { z } from 'zod';

const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPromptOption3',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: z.object({
      productDisplayName: z.string(),
      customerCohort: z.string(),
      conversationHistory: z.string().describe("A JSON string of the conversation history so far, with each turn labeled 'AI:' or 'User:'. The user has just spoken."),
      knowledgeBaseContext: z.string().describe("A structured string of knowledge base content. The AI MUST use this as its primary source of truth for answering questions or handling objections."),
      lastUserResponse: z.string(),
    }) },
    output: { schema: z.object({
      nextResponse: z.string().min(1).describe("The AI agent's next full response to the user. This must be a conversational, detailed, and helpful response. If answering a question, provide a thorough answer using the Knowledge Base. If handling an objection, provide a complete rebuttal based on the Knowledge Base. If continuing the pitch, explain the next benefit conversationally."),
      action: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "CLOSING_STATEMENT", "WAITING"]).describe("The category of action the AI is taking."),
      isFinalPitchStep: z.boolean().optional().describe("Set to true if this is the final closing statement of the pitch, just before the call would naturally end."),
    }), format: "json" },
    prompt: `You are a smart, empathetic, and persuasive AI sales expert for {{{productDisplayName}}}. Your goal is to have a natural, helpful, and effective sales conversation. You MUST use the provided Knowledge Base as your sole source of truth for product details.

**Conversation History (User just spoke):**
  \`\`\`
  {{{conversationHistory}}}
  \`\`\`

**Knowledge Base Context (Your ONLY source of information):**
  \`\`\`
  {{{knowledgeBaseContext}}}
  \`\`\`

**Your Task:**
Analyze the **Last User Response ("{{{lastUserResponse}}}")** and generate a conversational nextResponse. You must infer the context from the history and use the Knowledge Base to act as a sales expert.

**Decision Framework:**

1.  **If user asks a question** (e.g., "What are the benefits?", "What is included in the plan?"):
    *   **Action:** \`ANSWER_QUESTION\`
    *   **nextResponse:** Scan the **Knowledge Base** for the relevant information and provide a comprehensive answer.
        *   *Good Example:* "That's a great question. Based on our product info, the main benefit subscribers talk about is the ad-free experience, which really lets you focus on the insights."
        *   *Bad Example:* "The benefits are an ad-free experience and newsletters."

2.  **If user gives a positive or neutral signal** (e.g., "okay", "tell me more", "I see"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **nextResponse:** Look at the conversation history to find the next logical point in a standard sales pitch. Create a natural, conversational bridge to it.
        *   *Good Example:* "Great. Building on that, another thing our subscribers find valuable is the exclusive market reports mentioned in our docs."
        *   *Bad Example:* "The next benefit is exclusive market reports."

3.  **If user raises an objection** (e.g., "it's too expensive", "I don't need this"):
    *   **Action:** \`REBUTTAL\`
    *   **nextResponse:** Scan the **Knowledge Base** for relevant counter-points or rebuttal strategies. Formulate an empathetic rebuttal using the **"Acknowledge, Empathize, Reframe (from KB), Question"** model.
        *   *Good Example:* "I understand price is an important consideration. Our knowledge base highlights that many subscribers feel the exclusive insights save them from costly mistakes, making the subscription pay for itself. Does that perspective help?"
        *   *Bad 'example':* "It is not expensive."

4.  **If user is clearly ending the conversation** (e.g., "okay bye", "not interested, thank you", "I have to go", "goodbye", "cut the call", "end the interaction"):
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Respond with a polite, brief closing remark.
        *   *Good Example:* "Alright, I understand. Thank you for your time, have a great day!"
        *   *Bad Example:* "Bye."
        
5.  **If conversation is naturally concluding from the AI's side**:
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Provide a clear final call to action based on information from the **Knowledge Base**.
        *   *Good Example:* "So, based on what we've discussed and the benefits like [Benefit from KB], would you like me to help you activate your subscription now?"

6.  **If user input is empty or just silence**:
    *   **Action:** \`WAITING\`
    *   **nextResponse:** A polite re-engagement prompt.
        *   *Good Example:* "Are you still there?" or "I'm here when you're ready."
        
Generate your response.`,
});


export const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    const response: VoiceSalesAgentFlowOutput = {
      conversationTurns: Array.isArray(flowInput.conversationHistory) ? [...flowInput.conversationHistory] : [],
      generatedPitch: flowInput.currentPitchState,
      nextExpectedAction: 'USER_RESPONSE',
      errorMessage: undefined,
      currentAiResponseText: undefined,
    };
    
    try {
        let {
            action, product, productDisplayName, brandName, salesPlan, etPlanConfiguration,
            offer, customerCohort, agentName, userName, knowledgeBaseContext,
            currentUserInputText,
        } = flowInput;

        // This flow now only processes user responses. The 'START_CONVERSATION' action is handled client-side.
        if (action === 'PROCESS_USER_RESPONSE') {
            if (!currentUserInputText) {
                // This is the inactivity detection case.
                response.currentAiResponseText = "Are you still there? If you need help, just let me know.";
                response.nextExpectedAction = 'USER_RESPONSE';
                return response;
            }

            try {
                // Restore KB context to every turn to handle questions/objections.
                const { output: routerResult } = await conversationRouterPrompt({
                    productDisplayName: productDisplayName,
                    customerCohort: customerCohort,
                    conversationHistory: JSON.stringify(response.conversationTurns),
                    lastUserResponse: currentUserInputText,
                    knowledgeBaseContext: knowledgeBaseContext, // Pass the KB on every turn.
                });

                if (!routerResult || !routerResult.nextResponse) {
                    // Fallback if AI router fails to provide a response
                    response.currentAiResponseText = "I'm sorry, I'm having a little trouble at the moment. Could you please repeat that?";
                    response.errorMessage = "AI router returned an empty or invalid response.";
                } else {
                    response.currentAiResponseText = routerResult.nextResponse;
                    response.nextExpectedAction = routerResult.isFinalPitchStep ? 'INTERACTION_ENDED' : 'USER_RESPONSE';
                }
            } catch (routerError: any) {
                 const errorMessage = `I'm sorry, I had trouble processing that. Could you please rephrase? (Error: ${routerError.message.substring(0, 100)}...)`;
                 response.errorMessage = routerError.message;
                 response.currentAiResponseText = errorMessage;
                 response.nextExpectedAction = 'USER_RESPONSE';
            }

        } else if (action === 'END_CALL') {
            response.currentAiResponseText = `Thank you for your time, ${userName || 'sir/ma\'am'}. Have a great day.`;
            response.nextExpectedAction = 'INTERACTION_ENDED';
        } else {
             throw new Error(`Invalid action received by the flow: ${action}. This flow only handles 'PROCESS_USER_RESPONSE' and 'END_CALL'.`);
        }
        
        return response;

    } catch (e: any) {
      console.error("Critical Unhandled Error in runVoiceSalesAgentTurn:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      const errorMessage = `I'm sorry, a critical system error occurred. Details: ${e.message.substring(0, 200)}...`;
      
      response.errorMessage = e.message;
      response.currentAiResponseText = errorMessage;
      response.nextExpectedAction = 'END_CALL_NO_SCORE';
      
      return response;
    }
  }
);
