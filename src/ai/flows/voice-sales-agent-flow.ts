
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation (Option 2 - Expressive Voices).
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation and relies on the app's main TTS API route for speech synthesis.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { z } from 'zod';


const replacePlaceholders = (text: string, context: VoiceSalesAgentFlowInput): string => {
    let replacedText = text;
    if (!text) return "";
    
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

const getInitialGreetingPrompt = ai.definePrompt({
    name: "getInitialGreetingPrompt",
    model: 'googleai/gemini-2.0-flash',
    input: { schema: z.object({
        userName: z.string().optional(),
        agentName: z.string().optional(),
        brandName: z.string(),
        customerCohort: z.string(),
    }) },
    output: { schema: z.object({ greeting: z.string() }) },
    prompt: `You are an AI sales agent for {{{brandName}}}. 
    Your task is to generate a warm, professional opening line for a sales call.
    
    Context:
    - Your Name: {{{agentName}}}
    - Customer's Name: {{{userName}}}
    - Customer's Cohort: {{{customerCohort}}}
    - Product Brand: {{{brandName}}}

    Instructions:
    1. Address the customer by name if provided (e.g., "Hello {{{userName}}},"). If not, use a general greeting.
    2. Introduce yourself by name and company (e.g., "my name is {{{agentName}}} from {{{brandName}}}.").
    3. State the reason for the call, tailored to the customer's cohort. For example:
        - For 'Payment Dropoff': "I'm calling because I noticed you were in the middle of subscribing..."
        - For 'Expired Users': "I'm calling because your subscription recently expired, and we have a special renewal offer..."
        - For 'New Prospect Outreach': "I'm calling to introduce you to our premium service..."
    4. Keep it concise and conversational.
    
    Generate only the greeting text.
    `,
});


const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPromptOption2',
    model: 'googleai/gemini-2.0-flash', // Using a faster model for quicker turns
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


const runVoiceSalesAgentTurnFlow = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurnFlow',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let {
      action,
      product,
      productDisplayName,
      brandName,
      salesPlan,
      etPlanConfiguration,
      offer,
      customerCohort,
      agentName,
      userName,
      knowledgeBaseContext,
      conversationHistory,
      currentPitchState,
      currentUserInputText,
    } = flowInput;

    let currentAiResponseText: string | undefined;
    let generatedPitch: GeneratePitchOutput | null = currentPitchState;
    let nextExpectedAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined;
    let updatedConversation = [...conversationHistory];

    try {
      if (action === 'START_CONVERSATION') {
        const pitchInput = { product, productDisplayName, brandName, customerCohort, etPlanConfiguration, knowledgeBaseContext, salesPlan, offer, agentName, userName };
        
        const pitchPromise = generatePitch(pitchInput);

        const { output: greetingResult } = await getInitialGreetingPrompt({
            userName: userName,
            agentName: agentName,
            brandName: brandName || productDisplayName,
            customerCohort: customerCohort,
        });

        currentAiResponseText = greetingResult?.greeting || `Hello ${userName}, this is ${agentName}. How are you today?`;
        generatedPitch = await pitchPromise; // Wait for the full pitch to use in subsequent turns.
        if (generatedPitch.pitchTitle.includes("Failed")) {
            console.warn(`Full pitch generation failed in the background: ${generatedPitch.warmIntroduction}`);
        }

      } else if (action === 'PROCESS_USER_RESPONSE') {
        if (!generatedPitch) throw new Error("Pitch state is missing, cannot continue conversation.");
        if (!currentUserInputText) throw new Error("User input text not provided for processing.");

        const { output: routerResult } = await conversationRouterPrompt({
            productDisplayName: productDisplayName,
            customerCohort: customerCohort,
            conversationHistory: JSON.stringify(conversationHistory),
            fullPitch: JSON.stringify(generatedPitch),
            lastUserResponse: currentUserInputText,
            knowledgeBaseContext: knowledgeBaseContext,
        });

        if (!routerResult || !routerResult.nextResponse) {
            throw new Error("AI router failed to determine the next response.");
        }
        
        currentAiResponseText = routerResult.nextResponse;
        nextExpectedAction = routerResult.isFinalPitchStep ? 'END_CALL' : 'USER_RESPONSE';

      } else if (action === 'END_CALL_AND_SCORE') {
        // This action is now handled on the dashboard, flow ends gracefully
         const closingMessage = `Thank you for your time, ${userName || 'sir/ma\'am'}. Have a great day.`;
         currentAiResponseText = closingMessage;
         nextExpectedAction = 'INTERACTION_ENDED';
      }

      if (currentAiResponseText) {
        const aiTurn = { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: currentAiResponseText, timestamp: new Date().toISOString() };
        updatedConversation.push(aiTurn);
      }
      
      const finalOutput = {
        conversationTurns: updatedConversation,
        currentAiResponseText,
        generatedPitch,
        nextExpectedAction,
        errorMessage,
      };

      // Replace placeholders in the final response text
      if (finalOutput.currentAiResponseText) {
          finalOutput.currentAiResponseText = replacePlaceholders(finalOutput.currentAiResponseText, flowInput);
      }

      return finalOutput;

    } catch (e: any) {
      console.error("Error in runVoiceSalesAgentTurn:", e);
      errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
      currentAiResponseText = errorMessage;
      return {
        conversationTurns: conversationHistory,
        currentAiResponseText,
        nextExpectedAction: "END_CALL_NO_SCORE",
        errorMessage: e.message,
        generatedPitch,
      };
    }
  }
);

export async function runVoiceSalesAgentTurn(input: VoiceSalesAgentFlowInput): Promise<VoiceSalesAgentFlowOutput> {
  return runVoiceSalesAgentTurnFlow(input);
}
