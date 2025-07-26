
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation, rebuttal, and speech synthesis.
 * - runVoiceSalesAgentTurn - Handles a turn in the conversation.
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
import { generateRebuttal } from './rebuttal-generator';
import { synthesizeSpeech } from './speech-synthesis-flow';
import { scoreCall } from './call-scoring';
import { z } from 'zod';

const ConversationRouterInputSchema = z.object({
  productDisplayName: z.string(),
  customerCohort: z.string(),
  conversationHistory: z.string(),
  fullPitch: z.custom<GeneratePitchOutput>().optional(),
  lastUserResponse: z.string(),
  knowledgeBaseContext: z.string(),
});

const ConversationRouterOutputSchema = z.object({
  nextResponse: z.string().describe("The AI agent's next full response to the user. This can be a continuation of the pitch, an answer to a question, or a rebuttal to an objection."),
  action: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "END_CALL"]).describe("The category of action the AI is taking."),
  isFinalPitchStep: z.boolean().optional().describe("Set to true if this is the final closing statement of the pitch."),
});

const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPrompt',
    model: 'googleai/gemini-2.0-flash',
    input: { schema: ConversationRouterInputSchema },
    output: { schema: ConversationRouterOutputSchema },
    prompt: `You are the brain of a conversational sales AI for {{{productDisplayName}}}. Your job is to decide the next best response in a sales call.

Context:
- Product: {{{productDisplayName}}}
- Customer Cohort: {{{customerCohort}}}
- Knowledge Base: {{{knowledgeBaseContext}}}

Conversation History (User is the last speaker):
{{{conversationHistory}}}

Last User Response to analyze: "{{{lastUserResponse}}}"

Your Task:
1.  Analyze the 'Last User Response'.
2.  Based on the conversation history and user's last response, decide your next action and generate the response.
3.  If the user asks a question, answer it concisely using the Knowledge Base. Set action to "ANSWER_QUESTION".
4.  If the user raises an objection (e.g., "it's too expensive", "I'm not interested"), generate a compelling rebuttal using the Knowledge Base. Set action to "REBUTTAL".
5.  If the user response is positive or neutral (e.g., "okay", "tell me more"), continue the sales pitch from where you left off. Use the provided full pitch sections as a guide for what to say next. Set action to "CONTINUE_PITCH".
6.  Generate the *complete* next response for the agent to say. Be natural and conversational.
`,
});


export const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let newConversationTurns: ConversationTurn[] = [];
    let currentPitch: GeneratePitchOutput | null = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeech;
    let callScore: ScoreCallOutput | undefined;
    let rebuttalResponse: string | undefined;
    let errorMessage: string | undefined;

    const addTurn = (speaker: 'AI' | 'User', text: string, audioDataUri?: string) => {
        const newTurn: ConversationTurn = { id: `turn-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString(), audioDataUri };
        newConversationTurns.push(newTurn);
        flowInput.conversationHistory.push(newTurn);
    };

    try {
        if (flowInput.action === "START_CONVERSATION") {
            const pitchResult = await generatePitch({
                product: flowInput.product, customerCohort: flowInput.customerCohort,
                etPlanConfiguration: flowInput.etPlanConfiguration, salesPlan: flowInput.salesPlan,
                offer: flowInput.offer, agentName: flowInput.agentName, userName: flowInput.userName,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            });
            currentPitch = pitchResult;
            
            const initialText = pitchResult.warmIntroduction || `Hello ${flowInput.userName}, this is ${flowInput.agentName} from ${flowInput.productDisplayName}. How can I help you?`;
            
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });
            addTurn("AI", initialText, currentAiSpeech.audioDataUri);
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!flowInput.currentUserInputText) throw new Error("User input text not provided for processing.");

            if (!currentPitch) {
                 throw new Error("Pitch state is missing. Cannot continue conversation.");
            }

            const routerResult = await conversationRouterPrompt({
                productDisplayName: flowInput.productDisplayName,
                customerCohort: flowInput.customerCohort,
                conversationHistory: flowInput.conversationHistory.map(t => `${t.speaker}: ${t.text}`).join('\n'),
                fullPitch: currentPitch,
                lastUserResponse: flowInput.currentUserInputText,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            });

            if (!routerResult.output || !routerResult.output.nextResponse) {
                throw new Error("AI router failed to determine the next response.");
            }
            
            const nextResponseText = routerResult.output.nextResponse;
            nextAction = routerResult.output.isFinalPitchStep ? 'END_CALL' : 'USER_RESPONSE';
            
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextResponseText, voiceProfileId: flowInput.voiceProfileId });
            addTurn("AI", nextResponseText, currentAiSpeech.audioDataUri);

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = flowInput.conversationHistory.map(t => `${t.speaker}: ${t.text}`).join('\n');
            
            callScore = await scoreCall({
                audioDataUri: "dummy-uri-for-text-scoring",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
            
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day!`;
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: closingMessage, voiceProfileId: flowInput.voiceProfileId });
            addTurn("AI", closingMessage, currentAiSpeech.audioDataUri);
            nextAction = "CALL_SCORED";
        }
        
        return {
            conversationTurns: newConversationTurns,
            currentAiSpeech,
            generatedPitch: currentPitch,
            callScore,
            rebuttalResponse,
            nextExpectedAction: nextAction,
            errorMessage
        };

    } catch (e: any) {
        console.error("Error in voiceSalesAgentFlow:", e);
        errorMessage = `I'm sorry, I encountered an internal error: ${e.message}. Please try again.`;
        try {
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId });
        } catch (ttsError: any) {
            console.error("TTS failed even for error message:", ttsError);
            currentAiSpeech = {
                text: errorMessage,
                audioDataUri: `tts-critical-error:[${errorMessage}]`,
                errorMessage: ttsError.message
            };
        }

        addTurn("AI", errorMessage, currentAiSpeech.audioDataUri);
        return {
            conversationTurns: newConversationTurns,
            nextExpectedAction: "END_CALL_NO_SCORE",
            errorMessage: e.message,
            currentAiSpeech,
            generatedPitch: currentPitch,
            rebuttalResponse: undefined,
            callScore: undefined
        };
    }
  }
);

    