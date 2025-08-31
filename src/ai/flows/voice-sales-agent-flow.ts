
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, generating the AI's TEXT response.
 * Speech synthesis is handled by the client.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  ConversationTurn,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { z } from 'zod';
import { format, differenceInSeconds } from 'date-fns';


const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPromptOption3',
    model: 'googleai/gemini-2.0-flash', // Switched to the faster model for instant response
    input: { schema: z.object({
      productDisplayName: z.string(),
      customerCohort: z.string(),
      conversationHistory: z.string().describe("A JSON string of the conversation history so far, with each turn labeled 'AI:' or 'User:'. The user has just spoken."),
      fullPitch: z.string().describe("A JSON string of the full generated pitch (for reference)."),
      lastUserResponse: z.string(),
      knowledgeBaseContext: z.string(),
    }) },
    output: { schema: z.object({
      nextResponse: z.string().min(1).describe("The AI agent's next full response to the user. This must be a conversational, detailed, and helpful response. If answering a question, provide a thorough answer. If handling an objection, provide a complete rebuttal. If continuing the pitch, explain the next benefit conversationally."),
      action: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "CLOSING_STATEMENT", "WAITING"]).describe("The category of action the AI is taking."),
      isFinalPitchStep: z.boolean().optional().describe("Set to true if this is the final closing statement of the pitch, just before the call would naturally end."),
    }), format: "json" },
    prompt: `You are a smart, empathetic, and persuasive AI sales expert for {{{productDisplayName}}}. Your goal is to have a natural, helpful, and effective sales conversation.

**Context for this Turn:**
- **Product:** {{{productDisplayName}}}
- **Guiding Pitch Structure:** You have a pre-generated pitch. Use its key points as a guide, but do not recite it verbatim. Adapt it.
  \`\`\`
  {{{fullPitch}}}
  \`\`\`
- **Knowledge Base:** This is your primary source of truth for facts.
  \`\`\`
  {{{knowledgeBaseContext}}}
  \`\`\`
- **Conversation History (User just spoke):**
  {{{conversationHistory}}}

**Your Task:**
Analyze the **Last User Response ("{{{lastUserResponse}}}")** and decide the best next step. Generate a conversational nextResponse.

**Decision Framework:**

1.  **If user asks a question** (e.g., "What are the benefits?"):
    *   **Action:** \`ANSWER_QUESTION\`
    *   **nextResponse:** Provide a comprehensive answer using the **Knowledge Base**.
        *   *Good Example:* "That's a great question. The main benefit our subscribers talk about is the ad-free experience, which really lets you focus on the insights."
        *   *Bad 'Example':* "The benefits are an ad-free experience and newsletters."

2.  **If user gives a positive or neutral signal** (e.g., "okay", "tell me more"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **nextResponse:** Look at the \`fullPitch\` and history to find the next key point. Create a natural, conversational bridge to it.
        *   *Good Example:* "Great. Building on that, another thing our subscribers find valuable is the exclusive market reports."
        *   *Bad 'Example':* "The next benefit is exclusive market reports."

3.  **If user raises an objection** (e.g., "it's too expensive"):
    *   **Action:** \`REBUTTAL\`
    *   **nextResponse:** Formulate an empathetic rebuttal using the **"Acknowledge, Empathize, Reframe, Question"** model. Use the Knowledge Base for counter-points.
        *   *Good Example:* "I understand price is an important consideration. Many subscribers feel the exclusive insights save them from costly mistakes, making the subscription pay for itself. Does that perspective help?"
        *   *Bad 'Example':* "It is not expensive."

4.  **If user is clearly ending the conversation** (e.g., "okay bye", "not interested, thank you", "I have to go", "goodbye", "cut the call", "end the interaction"):
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Respond with a polite, brief closing remark.
        *   *Good Example:* "Alright, I understand. Thank you for your time, have a great day!"
        *   *Bad 'Example':* "Bye."
        
5.  **If conversation is naturally concluding from the AI's side**:
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Provide a clear final call to action.
        *   *Good Example:* "So, based on what we've discussed, would you like me to help you activate your subscription now?"

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
            if (!response.generatedPitch) throw new Error("Pitch state is missing, cannot continue conversation.");
            if (!currentUserInputText) throw new Error("User input text not provided for processing.");

            try {
                const { output: routerResult } = await conversationRouterPrompt({
                    productDisplayName: productDisplayName, customerCohort: customerCohort,
                    conversationHistory: JSON.stringify(response.conversationTurns),
                    fullPitch: JSON.stringify(response.generatedPitch), lastUserResponse: currentUserInputText,
                    knowledgeBaseContext: knowledgeBaseContext,
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
        
        // The client will add the AI's response text to the conversation log. We return it here.
        // response.conversationTurns is just passed through from input.

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
