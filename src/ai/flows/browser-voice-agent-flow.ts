
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation using client-side TTS.
 * This is the primary flow for browser-based voice interactions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  GeneratePitchOutput,
  ConversationTurn,
} from '@/types';
import { generatePitch } from './pitch-generator';

export const BrowserVoiceAgentFlowInputSchema = z.object({
  product: z.string(),
  customerCohort: z.string(),
  agentName: z.string().optional(),
  userName: z.string().optional(),
  knowledgeBaseContext: z.string(),
  conversationHistory: z.array(z.custom<ConversationTurn>()),
  currentPitchState: z.custom<GeneratePitchOutput>().nullable(),
  currentUserInputText: z.string().optional(),
  action: z.enum([
    "START_CONVERSATION",
    "PROCESS_USER_RESPONSE",
    "END_CALL", // Simplified action
  ]),
});
export type BrowserVoiceAgentFlowInput = z.infer<typeof BrowserVoiceAgentFlowInputSchema>;


const ConversationRouterInputSchema = z.object({
  productDisplayName: z.string(),
  customerCohort: z.string(),
  conversationHistory: z.string().describe("A JSON string of the conversation history so far, with each turn labeled 'AI:' or 'User:'. The user has just spoken."),
  fullPitch: z.string().describe("A JSON string of the full generated pitch (for reference)."),
  lastUserResponse: z.string(),
  knowledgeBaseContext: z.string(),
});

const ConversationRouterOutputSchema = z.object({
  nextResponse: z.string().min(1).describe("The AI agent's next full response to the user. This must be a conversational, detailed, and helpful response. If answering a question, provide a thorough answer. If handling an objection, provide a complete rebuttal. If continuing the pitch, explain the next benefit conversationally."),
  action: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "CLOSING_STATEMENT"]).describe("The category of action the AI is taking."),
  isFinalPitchStep: z.boolean().optional().describe("Set to true if this is the final closing statement of the pitch, just before the call would naturally end."),
});


const conversationRouterPrompt = ai.definePrompt({
    name: 'browserVoiceAgentRouterPrompt',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: ConversationRouterInputSchema },
    output: { schema: ConversationRouterOutputSchema, format: "json" },
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

2.  **If user gives a positive or neutral signal** (e.g., "okay", "tell me more"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **nextResponse:** Look at the \`fullPitch\` and history to find the next key point. Create a natural, conversational bridge to it.
        *   *Good Example:* "Great. Building on that, another thing our subscribers find valuable is the exclusive market reports."

3.  **If user raises an objection** (e.g., "it's too expensive"):
    *   **Action:** \`REBUTTAL\`
    *   **nextResponse:** Formulate an empathetic rebuttal using the **"Acknowledge, Empathize, Reframe, Question"** model. Use the Knowledge Base for counter-points.
        *   *Good Example:* "I understand price is an important consideration. Many subscribers feel the exclusive insights save them from costly mistakes, making the subscription pay for itself. Does that perspective help?"

4.  **If user is clearly ending the conversation** (e.g., "bye", "not interested, thank you", "I have to go", "that's all for now"):
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Respond with a polite, brief closing remark.
        *   *Good Example:* "Alright, I understand. Thank you for your time, have a great day!"

Generate your response.`,
});


const getInitialGreeting = (userName?: string, agentName?: string, brandName?: string, cohort?: string) => {
    let greeting = `Hello ${userName || 'there'}, my name is ${agentName || 'your sales assistant'}`;
    if(brandName) greeting += ` from ${brandName}`;
    greeting += ". ";

    switch(cohort) {
        case "Payment Dropoff":
            greeting += "I'm calling because I noticed you were in the middle of subscribing and wanted to see if I could help you complete that process smoothly.";
            break;
        case "Expired Users":
            greeting += "I'm calling because your subscription recently expired, and we have a special renewal offer I thought you'd be interested in.";
            break;
        default:
            greeting += "I'm calling today to tell you about an exciting offer we have for you.";
            break;
    }
    return greeting;
}

export const runBrowserVoiceAgentTurn = ai.defineFlow(
  {
    name: 'runBrowserVoiceAgentTurn',
    inputSchema: BrowserVoiceAgentFlowInputSchema,
    outputSchema: z.object({
        aiResponseText: z.string(),
        generatedPitch: z.custom<GeneratePitchOutput>().nullable(),
        nextExpectedAction: z.enum(['USER_RESPONSE', 'INTERACTION_ENDED']),
        errorMessage: z.string().optional(),
    })
  },
  async (flowInput): Promise<{
    aiResponseText: string,
    generatedPitch: GeneratePitchOutput | null,
    nextExpectedAction: 'USER_RESPONSE' | 'INTERACTION_ENDED',
    errorMessage?: string,
  }> => {
    
    let {
      action,
      product,
      customerCohort,
      agentName,
      userName,
      knowledgeBaseContext,
      conversationHistory,
      currentPitchState,
      currentUserInputText,
    } = flowInput;

    let aiResponseText: string;
    let generatedPitch: GeneratePitchOutput | null = currentPitchState;
    let nextExpectedAction: 'USER_RESPONSE' | 'INTERACTION_ENDED' = 'USER_RESPONSE';
    
    try {
        if (action === "START_CONVERSATION") {
            const pitchInput = {
                product, customerCohort, knowledgeBaseContext, agentName, userName, brandName: product
            };
            generatedPitch = await generatePitch(pitchInput);
            if (generatedPitch.pitchTitle.includes("Failed")) {
                throw new Error(generatedPitch.warmIntroduction);
            }
            aiResponseText = getInitialGreeting(userName, agentName, product, customerCohort);

        } else if (action === "PROCESS_USER_RESPONSE") {
            if (!generatedPitch) throw new Error("Pitch state is missing.");
            if (!currentUserInputText) throw new Error("User input text not provided.");

            const { output: routerResult } = await conversationRouterPrompt({
                productDisplayName: product,
                customerCohort: customerCohort,
                conversationHistory: JSON.stringify(conversationHistory),
                fullPitch: JSON.stringify(generatedPitch),
                lastUserResponse: currentUserInputText,
                knowledgeBaseContext: knowledgeBaseContext,
            });

            if (!routerResult || !routerResult.nextResponse) {
                throw new Error("AI router failed to determine the next response.");
            }
            
            aiResponseText = routerResult.nextResponse;
            if (routerResult.isFinalPitchStep) {
                nextExpectedAction = 'INTERACTION_ENDED';
            }
        
        } else if (action === 'END_CALL') {
            aiResponseText = `Thank you for your time, ${userName || 'sir/ma\'am'}. Have a great day.`;
            nextExpectedAction = 'INTERACTION_ENDED';
        } else {
            throw new Error(`Invalid action provided: ${action}`);
        }

        return { aiResponseText, generatedPitch, nextExpectedAction };

    } catch (e: any) {
        console.error("Error in runBrowserVoiceAgentTurn:", e);
        const errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message.substring(0, 150)}`;
        return {
            aiResponseText: errorMessage,
            generatedPitch,
            nextExpectedAction: 'INTERACTION_ENDED',
            errorMessage: e.message,
        };
    }
  }
);
