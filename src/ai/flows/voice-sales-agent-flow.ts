
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow is now optimized for speed by separating initial pitch generation from the conversational loop.
 * It uses a router prompt to determine the next action based on conversational context.
 */

import { ai } from '@/ai/genkit';
import {
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  ConversationTurn,
  GeneratePitchOutputSchema,
} from '@/types';
import type { VoiceSalesAgentFlowInput, VoiceSalesAgentFlowOutput, GeneratePitchOutput } from '@/types';
import { z } from 'zod';
import { generatePitch } from './pitch-generator';

// This prompt is lean and fast. It only gets the history and the last user input.
// Its job is to decide WHAT to do next, not to generate long content from scratch.
const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPrompt',
    model: 'googleai/gemini-2.0-flash', // Optimized for speed
    input: { schema: z.object({
      conversationHistory: z.string().describe("A JSON string of the conversation history so far. The user has just spoken."),
      lastUserResponse: z.string(),
      // The full pitch is NOT sent every time. The AI uses the history to know where it is in the flow.
    }) },
    output: { schema: z.object({
      action: z.enum([
          "CONTINUE_PITCH", 
          "ANSWER_SALES_QUESTION",
          "HANDLE_SALES_OBJECTION",
          "ANSWER_SUPPORT_QUESTION",
          "CLOSING_STATEMENT",
          "ACKNOWLEDGE_AND_WAIT"
        ]).describe("The category of action the AI should take next based on the user's last response."),
      thought: z.string().describe("A brief internal thought process on why this action was chosen."),
    }), format: "json" },
    prompt: `You are an AI sales agent controller. Your task is to analyze the user's last response within the context of the conversation history and decide the next logical action for the AI agent to take.

**Conversation History:**
\`\`\`
{{{conversationHistory}}}
\`\`\`

**User's Last Response:** "{{{lastUserResponse}}}"

**Decision Framework:**

1.  **If the user asks a SUPPORT-related question** (keywords like "login", "OTP", "error", "help", "password", "not working"):
    *   **Action:** \`ANSWER_SUPPORT_QUESTION\`
    *   **Thought:** The user has a technical or support query that needs a factual answer.

2.  **If the user asks a SALES-related question** (keywords like "renewal", "price", "discount", "plan", "offer", "benefits", "features"):
    *   **Action:** \`ANSWER_SALES_QUESTION\`
    *   **Thought:** The user is asking for more details about the sales proposition.

3.  **If the user raises a sales OBJECTION** (e.g., "it's too expensive", "I don't have time", "I get this for free", "I'm not sure"):
    *   **Action:** \`HANDLE_SALES_OBJECTION\`
    *   **Thought:** The user has a concern about the sale that needs to be addressed before continuing.

4.  **If the user gives a positive or neutral continuation signal** (e.g., "okay", "tell me more", "I see", "hmm", "go on"):
    *   **Action:** \`CONTINUE_PITCH\`
    *   **Thought:** The user is engaged and ready for the next part of the sales pitch. Default to this if no other category fits.
    
5.  **If the user is clearly trying to end the conversation** (e.g., "I'm not interested", "goodbye", "I have to go"):
    *   **Action:** \`CLOSING_STATEMENT\`
    *   **Thought:** The conversation is over. The agent should provide a polite closing remark.
    
6.  **If the user's response is unclear, very short, or just an acknowledgement** (e.g., "ok", "yes", "no"):
    *   **Action:** \`ACKNOWLEDGE_AND_WAIT\`
    *   **Thought:** The user's input doesn't require a detailed response. A simple acknowledgement is best to keep the floor open for them.

Analyze the user's last response and determine the single best action. Default to sales-related actions if uncertain.`,
});

// A separate, specialized prompt for generating sales-focused answers from the KB.
const salesAnswerGeneratorPrompt = ai.definePrompt({
    name: 'salesAnswerGeneratorPrompt',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: z.object({
        userQuestion: z.string(),
        knowledgeBaseContext: z.string(),
        conversationHistory: z.string(),
    })},
    output: { schema: z.object({
        answer: z.string().describe("A direct, helpful, and conversational answer to the user's sales-related question, based ONLY on the provided Knowledge Base context. Maintain a persuasive, elite sales tone."),
    })},
    prompt: `You are a helpful AI sales assistant. The user has asked a sales-related question (about price, plans, discounts, etc.). Use the provided Knowledge Base context to answer it accurately and persuasively.

CRITICAL: Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context' section below. If a 'USER-SELECTED KB CONTEXT' section is present, it is your PRIMARY and ONLY source of truth. Do NOT invent facts.

**Knowledge Base Context:**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Conversation History (for context):**
\`\`\`
{{{conversationHistory}}}
\`\`\`

**User's Question:** "{{{userQuestion}}}"

Generate the best possible answer based *only* on the Knowledge Base. If the KB does not contain the answer, politely say so and offer to find more information, while pivoting back to a known strength.`,
});


// A separate, specialized prompt for generating support-focused answers from the KB.
const supportAnswerGeneratorPrompt = ai.definePrompt({
    name: 'supportAnswerGeneratorPrompt',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: z.object({
        userQuestion: z.string(),
        knowledgeBaseContext: z.string(),
        conversationHistory: z.string(),
    })},
    output: { schema: z.object({
        answer: z.string().describe("A crisp, factual, step-by-step support answer to the user's question, based ONLY on the provided Knowledge Base context. Do not use a sales tone."),
    })},
    prompt: `You are a crisp, factual AI support assistant. The user has asked a support question (about login, errors, help, etc.). Use the provided Knowledge Base context to provide a clear, direct answer.

CRITICAL: Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context' section below. Do not invent facts or use a sales tone.

**Knowledge Base Context:**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Conversation History (for context):**
\`\`\`
{{{conversationHistory}}}
\`\`\`

**User's Question:** "{{{userQuestion}}}"

Generate the best possible factual answer based *only* on the Knowledge Base. If the KB does not contain the answer, politely state that you don't have the information and suggest they visit the help center or speak to a human agent.`,
});


// A separate, specialized prompt for handling objections from the KB.
const objectionHandlerPrompt = ai.definePrompt({
    name: 'objectionHandlerPrompt',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: z.object({
        userObjection: z.string(),
        knowledgeBaseContext: z.string(),
        conversationHistory: z.string(),
    })},
     output: { schema: z.object({
        rebuttal: z.string().describe("An empathetic and persuasive rebuttal to the user's objection, based ONLY on the provided Knowledge Base context."),
    })},
    prompt: `You are an expert AI sales coach. The user has raised an objection. Use the provided Knowledge Base context to craft an empathetic and effective rebuttal.

CRITICAL: Your entire response MUST be grounded in the information provided in the 'Knowledge Base Context' section below. If a 'USER-SELECTED KB CONTEXT' section is present, it is your PRIMARY and ONLY source of truth. Do NOT invent facts.

**Knowledge Base Context:**
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Conversation History (for context):**
\`\`\`
{{{conversationHistory}}}
\`\`\`

**User's Objection:** "{{{userObjection}}}"

Follow the "Acknowledge, Bridge, Benefit, Clarify" model to generate a response based *only* on the Knowledge Base. If the KB doesn't have a direct counter, acknowledge the objection and pivot to a related strength from the KB.`,
});


// Helper to get the next logical section from the pre-generated pitch
const getNextPitchSection = (
  conversation: ConversationTurn[],
  pitch: GeneratePitchOutput
): { text: string; isFinal: boolean } => {
    const saidTexts = new Set(conversation.filter(t => t.speaker === 'AI').map(t => t.text));
    
    if (!saidTexts.has(pitch.personalizedHook)) return { text: pitch.personalizedHook, isFinal: false };
    if (!saidTexts.has(pitch.productExplanation)) return { text: pitch.productExplanation, isFinal: false };
    if (!saidTexts.has(pitch.keyBenefitsAndBundles)) return { text: pitch.keyBenefitsAndBundles, isFinal: false };
    if (!saidTexts.has(pitch.discountOrDealExplanation)) return { text: pitch.discountOrDealExplanation, isFinal: false };
    if (!saidTexts.has(pitch.objectionHandlingPreviews)) return { text: pitch.objectionHandlingPreviews, isFinal: false };
    
    return { text: pitch.finalCallToAction, isFinal: true };
};


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
            action, knowledgeBaseContext,
            currentUserInputText, inactivityCounter
        } = flowInput;

        if (action === 'START_CONVERSATION') {
            const pitch = await generatePitch({
                product: flowInput.product,
                customerCohort: flowInput.customerCohort,
                knowledgeBaseContext: knowledgeBaseContext,
                agentName: flowInput.agentName,
                userName: flowInput.userName,
                brandName: flowInput.brandName,
                salesPlan: flowInput.salesPlan,
                specialPlanConfigurations: flowInput.etPlanConfiguration,
                offer: flowInput.offer,
            });

            if (pitch.pitchTitle.includes("Failed")) {
                throw new Error(pitch.warmIntroduction);
            }
            response.generatedPitch = pitch;
            response.currentAiResponseText = pitch.warmIntroduction;

        } else if (action === 'PROCESS_USER_RESPONSE') {
            if (!currentUserInputText) {
                // Inactivity detection case
                 const reminders = [
                    "Just wanted to check if you were still there. I'm ready whenever you are.",
                    "Just checking in, I'm here when you're ready to continue.",
                    "Is there anything I can clarify for you?",
                    "I am waiting for your response.",
                ];
                response.currentAiResponseText = reminders[inactivityCounter! % reminders.length];
                response.nextExpectedAction = 'USER_RESPONSE';
                return response;
            }
            if (!response.generatedPitch) {
                 throw new Error("Cannot process response: The initial sales pitch has not been generated yet.");
            }

            const routerResult = await conversationRouterPrompt({
                conversationHistory: JSON.stringify(response.conversationTurns),
                lastUserResponse: currentUserInputText,
            });
            
            switch (routerResult.output?.action) {
                case 'CONTINUE_PITCH':
                    const nextSection = getNextPitchSection(response.conversationTurns, response.generatedPitch);
                    response.currentAiResponseText = nextSection.text;
                    if(nextSection.isFinal) response.nextExpectedAction = 'INTERACTION_ENDED';
                    break;
                
                case 'ANSWER_SALES_QUESTION':
                    const salesAnswerResult = await salesAnswerGeneratorPrompt({
                        userQuestion: currentUserInputText,
                        knowledgeBaseContext: knowledgeBaseContext,
                        conversationHistory: JSON.stringify(response.conversationTurns),
                    });
                    response.currentAiResponseText = salesAnswerResult.output?.answer;
                    break;
                
                case 'ANSWER_SUPPORT_QUESTION':
                    const supportAnswerResult = await supportAnswerGeneratorPrompt({
                        userQuestion: currentUserInputText,
                        knowledgeBaseContext: knowledgeBaseContext,
                        conversationHistory: JSON.stringify(response.conversationTurns),
                    });
                    response.currentAiResponseText = supportAnswerResult.output?.answer;
                    break;

                case 'HANDLE_SALES_OBJECTION':
                     const rebuttalResult = await objectionHandlerPrompt({
                        userObjection: currentUserInputText,
                        knowledgeBaseContext: knowledgeBaseContext,
                        conversationHistory: JSON.stringify(response.conversationTurns),
                    });
                    response.currentAiResponseText = rebuttalResult.output?.rebuttal;
                    break;

                case 'CLOSING_STATEMENT':
                    response.currentAiResponseText = "I understand. Thank you for your time. Have a great day!";
                    response.nextExpectedAction = 'INTERACTION_ENDED';
                    break;

                case 'ACKNOWLEDGE_AND_WAIT':
                    response.currentAiResponseText = "Okay.";
                    break;
                
                default:
                    response.currentAiResponseText = "I'm sorry, I'm not sure how to respond to that. Could you clarify?";
                    break;
            }

        } else if (action === 'END_CALL') {
            response.currentAiResponseText = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day.`;
            response.nextExpectedAction = 'INTERACTION_ENDED';
        } else {
             throw new Error(`Invalid action received by the flow: ${action}.`);
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
