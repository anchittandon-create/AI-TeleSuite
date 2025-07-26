
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation, rebuttal, and speech synthesis.
 * - runVoiceSalesAgentTurn - Handles a turn in the conversation.
 * - VoiceSalesAgentFlowInput - Input type for the flow.
 * - VoiceSalesAgentFlowOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  Product,
  ETPlanConfiguration,
  SalesPlan,
  CustomerCohort,
  ConversationTurn,
  GeneratePitchOutput,
  ScoreCallOutput,
  SimulatedSpeechOutput,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal } from './rebuttal-generator';
import { synthesizeSpeech } from './speech-synthesis-flow';
import { scoreCall } from './call-scoring';

export const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.string(),
  productDisplayName: z.string(),
  salesPlan: z.string().optional(),
  etPlanConfiguration: z.string().optional(),
  offer: z.string().optional(),
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
    "GET_REBUTTAL",
    "END_CALL_AND_SCORE",
    "END_CALL_NO_SCORE",
  ]),
  voiceProfileId: z.string().optional(),
});
export type VoiceSalesAgentFlowInput = z.infer<typeof VoiceSalesAgentFlowInputSchema>;


export const VoiceSalesAgentFlowOutputSchema = z.object({
    conversationTurns: z.array(z.custom<ConversationTurn>()),
    currentAiSpeech: z.custom<SimulatedSpeechOutput>().optional(),
    generatedPitch: z.custom<GeneratePitchOutput>().optional(),
    rebuttalResponse: z.string().optional(),
    callScore: z.custom<ScoreCallOutput>().optional(),
    nextExpectedAction: z.enum([
        'USER_RESPONSE',
        'GET_REBUTTAL',
        'CONTINUE_PITCH',
        'END_CALL',
        'CALL_SCORED',
        'END_CALL_NO_SCORE',
    ]),
    errorMessage: z.string().optional(),
});
export type VoiceSalesAgentFlowOutput = z.infer<typeof VoiceSalesAgentFlowOutputSchema>;


const voiceSalesAgentFlow = ai.defineFlow(
  {
    name: 'voiceSalesAgentFlow',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let newConversationTurns: ConversationTurn[] = [];
    let currentPitch = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeech: SimulatedSpeechOutput | undefined = undefined;
    let callScore: ScoreCallOutput | undefined = undefined;

    const addTurn = (speaker: 'AI' | 'User', text: string, audioDataUri?: string) => {
        const turn = { id: `turn-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString(), audioDataUri };
        newConversationTurns.push(turn);
    };

    try {
        if (flowInput.action === "START_CONVERSATION") {
            const pitchInput = {
                product: flowInput.product as Product,
                customerCohort: flowInput.customerCohort as CustomerCohort,
                etPlanConfiguration: flowInput.etPlanConfiguration as ETPlanConfiguration,
                salesPlan: flowInput.salesPlan as SalesPlan,
                offer: flowInput.offer,
                agentName: flowInput.agentName,
                userName: flowInput.userName,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            };
            const generatedPitch = await generatePitch(pitchInput);
            
            if (generatedPitch.pitchTitle.startsWith("Pitch Generation Failed")) {
                const errorMessage = generatedPitch.fullPitchScript;
                addTurn("AI", errorMessage);
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId });
                return { conversationTurns: newConversationTurns, nextExpectedAction: "END_CALL_NO_SCORE", errorMessage, currentAiSpeech };
            }

            currentPitch = generatedPitch;
            const initialText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
            addTurn("AI", initialText);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!currentPitch) throw new Error("Pitch state is missing.");
            
            const deliveredSections = new Set(flowInput.conversationHistory.filter(t => t.speaker === 'AI').map(t => t.text));
            let nextResponseText = "";
            
            const sectionsInOrder = [
                currentPitch.productExplanation,
                currentPitch.keyBenefitsAndBundles,
                currentPitch.discountOrDealExplanation,
                currentPitch.objectionHandlingPreviews,
                currentPitch.finalCallToAction
            ];

            const deliveredTexts = new Set(flowInput.conversationHistory.map(t => t.text.trim()));
            const nextSectionToDeliver = sectionsInOrder.find(section => !deliveredTexts.has(section.trim()));
            
            if (nextSectionToDeliver) {
                nextResponseText = nextSectionToDeliver;
                if (nextSectionToDeliver === currentPitch.finalCallToAction) {
                    nextAction = 'END_CALL';
                }
            } else {
                nextResponseText = `Is there anything else I can help you with regarding the ${flowInput.productDisplayName} subscription?`;
                nextAction = 'END_CALL';
            }
            
            if (nextResponseText.trim()) {
                addTurn("AI", nextResponseText);
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextResponseText, voiceProfileId: flowInput.voiceProfileId });
            } else {
                 throw new Error("Could not determine the next response text. All pitch sections may have been delivered.");
            }

        } else if (flowInput.action === "GET_REBUTTAL") {
            if (!flowInput.currentUserInputText) throw new Error("Objection text not provided for rebuttal.");
            const rebuttalResult = await generateRebuttal({
                objection: flowInput.currentUserInputText,
                product: flowInput.product as Product,
                knowledgeBaseContext: flowInput.knowledgeBaseContext
            });
            addTurn("AI", rebuttalResult.rebuttal);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalResult.rebuttal, voiceProfileId: flowInput.voiceProfileId });

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = [...flowInput.conversationHistory, ...newConversationTurns].map(t => `${t.speaker}: ${t.text}`).join('\n');
            const dummyAudioUri = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

            // scoreCall now expects a second argument for the transcript override
            const scoreResult = await scoreCall({
                audioDataUri: dummyAudioUri,
                product: flowInput.product as Product,
                agentName: flowInput.agentName,
            });
            callScore = scoreResult;
            
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day!`;
            addTurn("AI", closingMessage);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: closingMessage, voiceProfileId: flowInput.voiceProfileId });
            nextAction = "CALL_SCORED";
        }
        
        return {
            conversationTurns: newConversationTurns,
            currentAiSpeech,
            generatedPitch: currentPitch || undefined,
            callScore,
            nextExpectedAction: nextAction,
        };

    } catch (e: any) {
        console.error("Error in voiceSalesAgentFlow:", e);
        const errorMessage = `I'm sorry, I encountered an internal error: ${e.message}. Please try again.`;
        addTurn("AI", errorMessage);
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId });
        return {
            conversationTurns: newConversationTurns,
            nextExpectedAction: "END_CALL_NO_SCORE",
            errorMessage: e.message,
            currentAiSpeech
        };
    }
  }
);


export async function runVoiceSalesAgentTurn(input: VoiceSalesAgentFlowInput): Promise<VoiceSalesAgentFlowOutput> {
  return await voiceSalesAgentFlow(input);
}
