
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation (Option 2).
 * This flow is a replica of the original but is designed to work with a client-side
 * speech synthesis call to a self-hosted engine like OpenTTS.
 * It now returns the text to be spoken, and the client is responsible for generating audio.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  ScoreCallOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
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

// Re-using the same robust conversation router prompt
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
        *   'nextResponse': Formulate a comprehensive answer using the 'knowledgeBaseContext' as your primary source. Do not just list features; explain the benefits to the user conversationally.
    *   **If the user raises an objection** (e.g., "it's too expensive", "I'm not interested", "I don't have time"):
        *   Action: 'REBUTTAL'.
        *   'nextResponse': Formulate a compelling and empathetic rebuttal. Use the "Acknowledge, Bridge, Benefit, Clarify/Question" structure. Use the 'knowledgeBaseContext' and the 'fullPitch' to find counter-points.
    *   **If the user response is positive or neutral** (e.g., "okay", "tell me more", "mm-hmm"):
        *   Action: 'CONTINUE_PITCH'.
        *   'nextResponse': Look at the 'fullPitch' reference and the 'conversationHistory' to see which key point is next. Introduce the next key benefit in a natural, conversational way.
    *   **If the conversation is naturally concluding**:
        *   Action: 'CLOSING_STATEMENT'.
        *   Set 'isFinalPitchStep' to 'true'.
        *   'nextResponse': Provide a confident and clear final call to action.

3.  **Critical Guidelines for 'nextResponse'**:
    *   Your response must be **fully detailed and conversational**.
    *   Always ground your facts in the 'knowledgeBaseContext'.
    *   Maintain a confident, helpful, and professional tone.
`,
});

// The output schema for this flow now returns the text to be spoken, client handles audio.
const VoiceSalesAgentFlowOutputSchemaOption2 = z.object({
    conversationTurns: z.array(z.custom<ConversationTurn>()),
    generatedPitch: z.custom<GeneratePitchOutput>().nullable(),
    callScore: z.custom<ScoreCallOutput>().optional(),
    nextExpectedAction: z.enum([
        'USER_RESPONSE', 'GET_REBUTTAL', 'CONTINUE_PITCH', 'END_CALL', 'CALL_SCORED', 'END_CALL_NO_SCORE'
    ]),
    errorMessage: z.string().optional(),
});
type VoiceSalesAgentFlowOutputOption2 = z.infer<typeof VoiceSalesAgentFlowOutputSchemaOption2>;


export const runVoiceSalesAgentTurnOption2 = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurnOption2',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchemaOption2,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutputOption2> => {
    let newConversationTurns: ConversationTurn[] = [];
    let currentPitch: GeneratePitchOutput | null = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutputOption2['nextExpectedAction'] = 'USER_RESPONSE';
    let callScore: ScoreCallOutput | undefined;
    let errorMessage: string | undefined;

    const addTurn = (speaker: 'AI' | 'User', text: string) => {
        const newTurn: ConversationTurn = { id: `turn-opt2-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString() };
        newConversationTurns.push(newTurn);
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
            addTurn("AI", initialText);
            
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
            nextAction = routerResult.isFinalPitchStep ? 'END_CALL' : 'USER_RESPONSE';
            addTurn("AI", nextResponseText);

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = flowInput.conversationHistory.map(t => `${t.speaker}: ${t.text}`).join('\n');
            
            callScore = await scoreCall({
                audioDataUri: "dummy-uri-for-text-scoring",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
            
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day!`;
            addTurn("AI", closingMessage);
            nextAction = "CALL_SCORED";
        }
        
        return {
            conversationTurns: newConversationTurns,
            generatedPitch: currentPitch,
            callScore,
            nextExpectedAction: nextAction,
            errorMessage
        };

    } catch (e: any) {
      console.error("Error in voiceSalesAgentFlowOption2 (logic part):", e);
      errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
      addTurn("AI", errorMessage);
      return {
          conversationTurns: newConversationTurns,
          nextExpectedAction: "END_CALL_NO_SCORE",
          errorMessage: e.message,
          generatedPitch: currentPitch,
          callScore: undefined
      };
    }
  }
);
