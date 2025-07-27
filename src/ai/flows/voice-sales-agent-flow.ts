
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
import { synthesizeSpeech } from './speech-synthesis-flow';
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
  nextResponse: z.string().min(1).describe("The AI agent's next full response to the user. This can be a continuation of the pitch, an answer to a question, or a rebuttal to an objection. Be natural and conversational."),
  action: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "CLOSING_STATEMENT"]).describe("The category of action the AI is taking."),
  isFinalPitchStep: z.boolean().optional().describe("Set to true if this is the final closing statement of the pitch, just before the call would naturally end."),
});

const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPrompt',
    model: 'googleai/gemini-1.5-flash-latest',
    input: { schema: ConversationRouterInputSchema },
    output: { schema: ConversationRouterOutputSchema, format: "json" },
    prompt: `You are the brain of a conversational sales AI for {{{productDisplayName}}}. Your job is to decide the next best response in a sales call. You must be a smart answer provider, not just a script-reader.

Context:
- Product: {{{productDisplayName}}}
- Customer Cohort: {{{customerCohort}}}
- Knowledge Base: {{{knowledgeBaseContext}}}
- The full generated pitch (for reference): {{{fullPitch}}}

Conversation History (User is the last speaker):
{{{conversationHistory}}}

Last User Response to analyze: "{{{lastUserResponse}}}"

Your Task:
1.  Analyze the 'Last User Response'. Understand the user's intent. Are they asking a question, raising an objection, giving a positive/neutral signal, or something else?
2.  Based on the conversation history and the user's last response, decide your next action and generate the response.
3.  If the user asks a question, answer it concisely using the Knowledge Base. Set action to "ANSWER_QUESTION". If the question requires a detailed explanation, provide one, but keep it relevant.
4.  If the user raises an objection (e.g., "it's too expensive", "I'm not interested"), formulate a compelling rebuttal using the Knowledge Base. Set action to "REBUTTAL".
5.  If the user response is positive or neutral (e.g., "okay", "tell me more"), continue the sales pitch from where you left off. Use the provided full pitch sections as a guide for what to say next, but rephrase it conversationally. Do not just read the next section. Set action to "CONTINUE_PITCH".
6.  If you have presented all key benefits and the conversation is naturally concluding, provide a final call to action. Set action to "CLOSING_STATEMENT" and isFinalPitchStep to true.
7.  Generate the *complete and specific* next response for the agent to say. Be natural and conversational. Avoid robotic language.
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
    let errorMessage: string | undefined;

    const addTurn = (speaker: 'AI' | 'User', text: string, audioDataUri?: string) => {
        const newTurn: ConversationTurn = { id: `turn-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString(), audioDataUri };
        newConversationTurns.push(newTurn);
        // The page will manage the full history and pass it back in.
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
            
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });
            if(currentAiSpeech.errorMessage) throw new Error(currentAiSpeech.errorMessage);
            addTurn("AI", initialText, currentAiSpeech.audioDataUri);
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!flowInput.currentUserInputText) throw new Error("User input text not provided for processing.");
            if (!currentPitch) throw new Error("Pitch state is missing. Cannot continue conversation.");

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
            
            const nextResponseText = routerResult.nextResponse;
            nextAction = routerResult.isFinalPitchStep ? 'END_CALL' : 'USER_RESPONSE';
            
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextResponseText, voiceProfileId: flowInput.voiceProfileId });
            if(currentAiSpeech.errorMessage) throw new Error(currentAiSpeech.errorMessage);
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
            if(currentAiSpeech.errorMessage) throw new Error(currentAiSpeech.errorMessage);
            addTurn("AI", closingMessage, currentAiSpeech.audioDataUri);
            nextAction = "CALL_SCORED";
        }
        
        return {
            conversationTurns: newConversationTurns,
            currentAiSpeech,
            generatedPitch: currentPitch,
            callScore,
            nextExpectedAction: nextAction,
            errorMessage
        };

    } catch (e: any) {
        console.error("Error in voiceSalesAgentFlow:", e);
        errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
        try {
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId });
        } catch (ttsError: any) {
            console.error("TTS failed even for error message:", ttsError);
            currentAiSpeech = {
                text: errorMessage,
                audioDataUri: `tts-critical-error:[${errorMessage}]`,
                errorMessage: ttsError.message,
                voiceProfileId: flowInput.voiceProfileId
            };
        }

        addTurn("AI", errorMessage, currentAiSpeech.audioDataUri);
        return {
            conversationTurns: newConversationTurns,
            nextExpectedAction: "END_CALL_NO_SCORE",
            errorMessage: e.message,
            currentAiSpeech,
            generatedPitch: currentPitch,
            callScore: undefined
        };
    }
  }
);
