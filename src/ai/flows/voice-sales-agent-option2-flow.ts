
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation (Option 2 - Expressive Voices).
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation and relies on the app's main TTS API route for speech synthesis.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  ScoreCallOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  ConversationTurn,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { scoreCall } from './call-scoring';
import { z } from 'zod';

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

// A more robust and detailed prompt for the conversation router
const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPromptOption2',
    model: 'googleai/gemini-1.5-flash-latest',
    input: { schema: ConversationRouterInputSchema },
    output: { schema: ConversationRouterOutputSchema, format: "json" },
    prompt: `You are the brain of a conversational sales AI for {{{productDisplayName}}}. Your job is to decide the next best response in a sales call. You must be a smart answer provider, not just a script-reader. Your responses must be detailed, conversational, and persuasive.

Context:
- Product: {{{productDisplayName}}}
- Customer Cohort: {{{customerCohort}}}
- Knowledge Base: Use this as your primary source of truth for facts.
  \`\`\`
  {{{knowledgeBaseContext}}}
  \`\`\`
- The Full Generated Pitch (use this as a guide for key selling points and structure):
  \`\`\`
  {{{fullPitch}}}
  \`\`\`

Conversation History (User is the last speaker):
{{{conversationHistory}}}

Last User Response to analyze: "{{{lastUserResponse}}}"

Your Task:
1.  **Analyze the 'Last User Response'**: Understand the user's intent. Are they asking a question, raising an objection, giving a positive/neutral signal, or something else?

2.  **Decide on the Next Action & Generate a Detailed Response**:
    *   **If the user asks a specific question** (e.g., "What are the benefits?", "How does it work?", "What about pricing?"):
        *   Action: 'ANSWER_QUESTION'.
        *   'nextResponse': Formulate a comprehensive answer using the 'knowledgeBaseContext' as your primary source. Do not just list features; explain the benefits to the user conversationally. If the KB doesn't have the answer, politely state you'll need to check on that specific detail, but then pivot back to a known benefit from the pitch guide.
    *   **If the user raises an objection** (e.g., "it's too expensive", "I'm not interested", "I don't have time"):
        *   Action: 'REBUTTAL'.
        *   'nextResponse': Formulate a compelling and empathetic rebuttal. Use the "Acknowledge, Bridge, Benefit, Clarify/Question" structure. Use the 'knowledgeBaseContext' and the 'fullPitch' to find counter-points. Example: "I understand that price is an important factor. Many subscribers find that the exclusive market reports save them hours of research, which can be even more valuable than the subscription cost itself. Does that perspective help?" This must be a full, detailed response.
    *   **If the user response is positive or neutral** (e.g., "okay", "tell me more", "mm-hmm"):
        *   Action: 'CONTINUE_PITCH'.
        *   'nextResponse': Look at the 'fullPitch' reference and the 'conversationHistory' to see which key point is next. **Do not just read the next section verbatim.** Instead, introduce the next key benefit or feature in a natural, conversational way. For example: "That's great to hear. Building on that, another thing our subscribers really love is the ad-free experience, which lets you focus on the insights without any distractions."
    *   **If the conversation is naturally concluding** (you've covered the main points and handled objections):
        *   Action: 'CLOSING_STATEMENT'.
        *   Set 'isFinalPitchStep' to 'true'.
        *   'nextResponse': Provide a confident and clear final call to action. For example: "So, based on what we've discussed, would you like me to help you activate your subscription with this offer right now?"

3.  **Critical Guidelines for 'nextResponse'**:
    *   Your response must be **fully detailed and conversational**, not just a short phrase.
    *   Always ground your facts in the 'knowledgeBaseContext'.
    *   Maintain a confident, helpful, and professional tone.
`,
});


export const runVoiceSalesAgentOption2Turn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentOption2Turn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let currentPitch: GeneratePitchOutput | null = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeechText: string | undefined;
    let callScore: ScoreCallOutput | undefined;
    let errorMessage: string | undefined;

    const addTurn = (speaker: 'AI' | 'User', text: string) => {
        // This function is now just for conceptual logging within this flow if needed,
        // as the frontend manages the official conversation array.
    };

    try {
        if (flowInput.action === "START_CONVERSATION") {
            currentPitch = await generatePitch({
                product: flowInput.product, customerCohort: flowInput.customerCohort,
                etPlanConfiguration: flowInput.etPlanConfiguration, salesPlan: flowInput.salesPlan,
                offer: flowInput.offer, agentName: flowInput.agentName, userName: flowInput.userName,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            });
            
            if (currentPitch.pitchTitle.includes("Failed")) {
                 throw new Error(`Pitch Generation Failed: ${currentPitch.warmIntroduction}`);
            }

            const initialText = `${currentPitch.warmIntroduction} ${currentPitch.personalizedHook}`;
            currentAiSpeechText = initialText;
            
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

            let nextResponseText = routerResult.nextResponse;
            currentAiSpeechText = nextResponseText;
            nextAction = routerResult.isFinalPitchStep ? 'END_CALL' : 'USER_RESPONSE';

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = flowInput.conversationHistory.map(t => `${t.speaker}: ${t.text}`).join('\n');
            
            callScore = await scoreCall({
                audioDataUri: "dummy-uri-for-text-scoring",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
            
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day!`;
            currentAiSpeechText = closingMessage;
            nextAction = "CALL_SCORED";
        }
        
        return {
            conversationTurns: [], // Frontend manages the full log
            currentAiSpeech: { text: currentAiSpeechText || "" }, // Return text only
            generatedPitch: currentPitch,
            callScore,
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
