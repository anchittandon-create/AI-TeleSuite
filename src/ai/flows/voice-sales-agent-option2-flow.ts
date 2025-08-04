
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation (Option 2 - Expressive Voices).
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation and relies on the app's main TTS API route for speech synthesis.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  VoiceSalesAgentOption2FlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentOption2FlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { z } from 'zod';


const replacePlaceholders = (text: string, context: VoiceSalesAgentOption2FlowInput): string => {
    let replacedText = text;
    // Replace specific placeholders first
    if (context.agentName) replacedText = replacedText.replace(/\{\{AGENT_NAME\}\}/g, context.agentName);
    if (context.userName) replacedText = replacedText.replace(/\{\{USER_NAME\}\}/g, context.userName);
    if (context.brandName) replacedText = replacedText.replace(/\{\{PRODUCT_NAME\}\}/g, context.brandName);
    else if (context.productDisplayName) replacedText = replacedText.replace(/\{\{PRODUCT_NAME\}\}/g, context.productDisplayName);
    
    if (context.customerCohort) replacedText = replacedText.replace(/\{\{USER_COHORT\}\}/g, context.customerCohort);
    if (context.salesPlan) replacedText = replacedText.replace(/\{\{PLAN_NAME\}\}/g, context.salesPlan);
    if (context.offer) replacedText = replacedText.replace(/\{\{OFFER_DETAILS\}\}/g, context.offer);
    
    // Replace any remaining generic placeholders (like in the pitch script)
    replacedText = replacedText.replace(/{{{agentName}}}/g, context.agentName || "your agent");
    replacedText = replacedText.replace(/{{{userName}}}/g, context.userName || "the customer");
    replacedText = replacedText.replace(/{{{product}}}/g, context.productDisplayName);
     
    // Final fallback for any missed placeholders
    replacedText = replacedText.replace(/\{\{AGENT_NAME\}\}/g, "your agent");
    replacedText = replacedText.replace(/\{\{USER_NAME\}\}/g, "sir/ma'am");
    replacedText = replacedText.replace(/\{\{PRODUCT_NAME\}\}/g, context.productDisplayName);
    replacedText = replacedText.replace(/\{\{USER_COHORT\}\}/g, "your category");
    replacedText = replacedText.replace(/\{\{PLAN_NAME\}\}/g, "the selected plan");
    replacedText = replacedText.replace(/\{\{OFFER_DETAILS\}\}/g, "the current offer");

    return replacedText;
}


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
    name: 'conversationRouterPromptOption2',
    model: 'googleai/gemini-2.0-flash', // Using a faster model for quicker turns
    input: { schema: ConversationRouterInputSchema },
    output: { schema: ConversationRouterOutputSchema, format: "json" },
    prompt: `You are "Alex", a smart, empathetic, and persuasive AI sales expert for {{{productDisplayName}}}. Your goal is to have a natural, helpful, and effective sales conversation.

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
        *   *Bad Example:* "The benefits are an ad-free experience and newsletters."

2.  **If user gives a positive or neutral signal** (e.g., "okay", "tell me more"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **nextResponse:** Look at the \`fullPitch\` and history to find the next key point. Create a natural, conversational bridge to it.
        *   *Good Example:* "Great. Building on that, another thing our subscribers find valuable is the exclusive market reports."
        *   *Bad Example:* "The next benefit is exclusive market reports."

3.  **If user raises an objection** (e.g., "it's too expensive"):
    *   **Action:** \`REBUTTAL\`
    *   **nextResponse:** Formulate an empathetic rebuttal using the **"Acknowledge, Empathize, Reframe, Question"** model. Use the Knowledge Base for counter-points.
        *   *Good Example:* "I understand price is an important consideration. Many subscribers feel the exclusive insights save them from costly mistakes, making the subscription pay for itself. Does that perspective help?"
        *   *Bad Example:* "It is not expensive."

4.  **If conversation is naturally concluding**:
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Provide a clear final call to action.
        *   *Good Example:* "So, based on what we've discussed, would you like me to help you activate your subscription now?"

Generate your response.`,
});


export const runVoiceSalesAgentOption2Turn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentOption2Turn',
    inputSchema: VoiceSalesAgentOption2FlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let currentPitch: GeneratePitchOutput | null = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeechText: string | undefined;
    let errorMessage: string | undefined;
    
    try {
        if (flowInput.action === "START_CONVERSATION") {
            currentPitch = await generatePitch({
                product: flowInput.product,
                customerCohort: flowInput.customerCohort,
                etPlanConfiguration: flowInput.etPlanConfiguration,
                salesPlan: flowInput.salesPlan,
                offer: flowInput.offer,
                agentName: flowInput.agentName,
                userName: flowInput.userName,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
                brandName: flowInput.brandName,
            });
            
            if (currentPitch.pitchTitle.includes("Failed")) {
                 throw new Error(`Pitch Generation Failed: ${currentPitch.warmIntroduction}`);
            }

            const initialText = `${currentPitch.warmIntroduction} ${currentPitch.personalizedHook}`;
            currentAiSpeechText = replacePlaceholders(initialText, flowInput);
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!flowInput.currentUserInputText) throw new Error("User input text not provided for processing.");
            if (!currentPitch) throw new Error("Pitch state is missing from the flow input. Cannot continue conversation.");

            const { output: routerResult } = await conversationRouterPrompt({
                productDisplayName: flowInput.productDisplayName,
                customerCohort: flowInput.customerCohort,
                conversationHistory: JSON.stringify(flowInput.conversationHistory),
                fullPitch: JSON.stringify(currentPitch),
                lastUserResponse: flowInput.currentUserInputText,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            });

            if (!routerResult || !routerResult.nextResponse) {
                throw new Error("AI router failed to determine the next response.");
            }

            currentAiSpeechText = replacePlaceholders(routerResult.nextResponse, flowInput);
            nextAction = routerResult.isFinalPitchStep ? 'END_CALL' : 'USER_RESPONSE';

        } else if (flowInput.action === "END_INTERACTION") {
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. The interaction has ended.`;
            currentAiSpeechText = replacePlaceholders(closingMessage, flowInput);
            nextAction = "INTERACTION_ENDED"; // New terminal state
        }
        
        return {
            conversationTurns: [],
            currentAiSpeech: { text: currentAiSpeechText || "" },
            generatedPitch: currentPitch,
            callScore: undefined,
            nextExpectedAction: nextAction,
            errorMessage
        };

    } catch (e: any) {
        console.error("Error in voiceSalesAgentOption2Flow:", e);
        errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
        currentAiSpeechText = errorMessage;
        return {
            conversationTurns: [],
            nextExpectedAction: "END_CALL_NO_SCORE",
            errorMessage: e.message,
            currentAiSpeech: { text: currentAiSpeechText },
            generatedPitch: currentPitch,
            callScore: undefined
        };
    }
  }
);
