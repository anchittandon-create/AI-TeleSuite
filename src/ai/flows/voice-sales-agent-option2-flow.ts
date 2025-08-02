
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
  brandName: z.string().optional(),
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

// A more robust and detailed prompt for the conversation router
const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPromptOption2',
    model: 'googleai/gemini-1.5-flash-latest',
    input: { schema: ConversationRouterInputSchema },
    output: { schema: ConversationRouterOutputSchema, format: "json" },
    prompt: `You are "Alex", a smart, empathetic, and persuasive AI sales expert for {{{productDisplayName}}}. Your goal is to have a natural, helpful, and effective sales conversation, not just to read a script.

**Your Persona:**
- **Knowledgeable & Confident:** You understand the product and its value.
- **Empathetic & Respectful:** You listen to the customer and acknowledge their perspective.
- **Helpful & Persuasive:** You guide the conversation towards a positive outcome without being pushy.

**Context for this Turn:**
- **Product:** {{{productDisplayName}}} (from brand: {{{brandName}}})
- **Customer Cohort:** {{{customerCohort}}}
- **Guiding Pitch Structure (for reference only):** You have a pre-generated pitch structure. Use its key points as a guide, but do not recite it verbatim. Adapt it to the flow of the conversation.
  \`\`\`
  {{{fullPitch}}}
  \`\`\`
- **Knowledge Base:** This is your primary source of truth for facts.
  \`\`\`
  {{{knowledgeBaseContext}}}
  \`\`\`

**Conversation So Far (User just spoke):**
{{{conversationHistory}}}

**Your Task:**
Analyze the **Last User Response ("{{{lastUserResponse}}}")** and decide the best next step. Generate a detailed, conversational nextResponse.

---
**Decision-Making Framework:**

1.  **If the user asks a specific question** (e.g., "What are the benefits?", "How does pricing work?"):
    *   **Action:** \`ANSWER_QUESTION\`
    *   **nextResponse:** Provide a comprehensive answer using the **Knowledge Base** as your primary source. Do not just list features; explain the benefits to the user conversationally.
        *   *Good Example:* "That's a great question. The main benefit our subscribers talk about is the ad-free experience, which really lets you focus on the insights without any distractions. It makes for a much faster and more pleasant reading experience."
        *   *Bad Example:* "The benefits are an ad-free experience and newsletters."
        *   If the KB doesn't have the answer, politely state that you'll need to check on that specific detail, but then pivot back to a known benefit from the pitch guide.

2.  **If the user gives a positive or neutral signal** (e.g., "okay", "tell me more", "mm-hmm", "I see"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **nextResponse:** Look at the \`fullPitch\` reference and the \`conversationHistory\` to see which key point is next. **DO NOT just recite the next section.** Instead, create a natural, conversational bridge.
        *   *Good Example:* "Great. Building on that, another thing our subscribers find incredibly valuable is the exclusive market reports. They save hours of research time, which is a huge advantage."
        *   *Bad Example:* "The next benefit is exclusive market reports."

3.  **If the user raises an objection or expresses hesitation** (e.g., "it's too expensive", "I'm not interested", "I don't have time"):
    *   **Action:** \`REBUTTAL\`
    *   **nextResponse:** Formulate a compelling and empathetic rebuttal using the **"Acknowledge, Empathize, Reframe, Question"** model. Use the \`knowledgeBaseContext\` and the \`fullPitch\` to find counter-points.
        *   *Good Example:* "I completely understand that price is an important consideration. Many subscribers who felt the same way initially have told us that the exclusive market insights saved them from making costly mistakes, making the subscription pay for itself. Does looking at it as a tool for protecting your investments change the perspective at all?"
        *   *Bad Example:* "It is not expensive. It has many features."

4.  **If the conversation is naturally concluding** (you've covered the main points and handled objections):
    *   **Action:** \`CLOSING_STATEMENT\`
    *   Set \`isFinalPitchStep\` to \`true\`.
    *   **nextResponse:** Provide a confident and clear final call to action.
        *   *Good Example:* "So, based on what we've discussed about the exclusive insights and ad-free experience, would you like me to help you activate your subscription with the current offer right now?"

5.  **If the user response is vague or unclear**:
    *   **Action:** \`ANSWER_QUESTION\` (Clarification)
    *   **nextResponse:** Gently ask for clarification.
        *   *Good Example:* "I'm sorry, I didn't quite catch that. Could you please elaborate a little on what you mean?"
---

**Final Check for \`nextResponse\`:**
- Is it conversational and natural?
- Is it detailed and helpful?
- Does it align with the "Alex" persona?
- Are all facts grounded in the Knowledge Base?

Generate your response now.`,
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
                brandName: flowInput.brandName,
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
