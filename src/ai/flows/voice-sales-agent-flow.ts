
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation, rebuttal, and speech synthesis.
 * - runVoiceSalesAgentTurn - Handles a turn in the conversation.
 */

import { ai } from '@/ai/genkit';
import {
  Product,
  ConversationTurn,
  GeneratePitchOutput,
  ScoreCallOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  SimulatedSpeechOutput,
  CustomerCohort,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal } from './rebuttal-generator';
import { synthesizeSpeech } from './speech-synthesis-flow';
import { scoreCall } from './call-scoring';


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
    let rebuttalResponse: string | undefined = undefined;

    const addTurn = (speaker: 'AI' | 'User', text: string, audioDataUri?: string) => {
        const turn = { id: `turn-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString(), audioDataUri };
        newConversationTurns.push(turn);
    };

    try {
        if (flowInput.action === "START_CONVERSATION") {
            const pitchInput = {
                product: flowInput.product,
                customerCohort: flowInput.customerCohort,
                etPlanConfiguration: flowInput.etPlanConfiguration,
                salesPlan: flowInput.salesPlan,
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
                return { conversationTurns: newConversationTurns, nextExpectedAction: "END_CALL_NO_SCORE", errorMessage, currentAiSpeech, generatedPitch: null, rebuttalResponse: undefined, callScore: undefined };
            }

            currentPitch = generatedPitch;
            const initialText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
            addTurn("AI", initialText);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!currentPitch) throw new Error("Pitch state is missing for processing user response.");
            
            // This set will contain the exact text of every AI turn so far in the conversation history
            const allPreviousAiTurns = new Set(
                [...flowInput.conversationHistory, ...newConversationTurns]
                .filter(t => t.speaker === 'AI')
                .map(t => t.text.trim())
            );
            
            let nextResponseText = "";
            
            // The sections of the pitch in their intended delivery order.
            const pitchSectionsInOrder = [
                currentPitch.productExplanation,
                currentPitch.keyBenefitsAndBundles,
                currentPitch.discountOrDealExplanation,
                currentPitch.objectionHandlingPreviews,
                currentPitch.finalCallToAction
            ];

            // Find the first section that has NOT been delivered yet.
            const nextSectionToDeliver = pitchSectionsInOrder.find(section => 
                section && section.trim() && !allPreviousAiTurns.has(section.trim())
            );

            if (nextSectionToDeliver) {
                nextResponseText = nextSectionToDeliver;
                if (nextSectionToDeliver === currentPitch.finalCallToAction) {
                    nextAction = 'END_CALL';
                }
            } else {
                // Fallback if all sections have been delivered or something goes wrong
                nextResponseText = `Is there anything else I can help you with regarding the ${flowInput.productDisplayName} subscription? Or shall we proceed with the offer?`;
                nextAction = 'END_CALL';
            }
            
            if (nextResponseText && nextResponseText.trim()) {
                addTurn("AI", nextResponseText);
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextResponseText, voiceProfileId: flowInput.voiceProfileId });
            } else {
                 // Final safety net, this should not be reached with the logic above.
                 const recoveryText = "I seem to have lost my train of thought. Could you tell me what you think about the offer so far?";
                 addTurn("AI", recoveryText);
                 currentAiSpeech = await synthesizeSpeech({ textToSpeak: recoveryText, voiceProfileId: flowInput.voiceProfileId });
            }

        } else if (flowInput.action === "GET_REBUTTAL") {
            if (!flowInput.currentUserInputText) throw new Error("Objection text not provided for rebuttal.");
            const rebuttalResult = await generateRebuttal({
                objection: flowInput.currentUserInputText,
                product: flowInput.product,
                knowledgeBaseContext: flowInput.knowledgeBaseContext
            });
            rebuttalResponse = rebuttalResult.rebuttal;
            addTurn("AI", rebuttalResponse);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalResponse, voiceProfileId: flowInput.voiceProfileId });

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = [...flowInput.conversationHistory, ...newConversationTurns].map(t => `${t.speaker}: ${t.text}`).join('\n');
            
            const scoreResult = await scoreCall({
                audioDataUri: "dummy", 
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
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
            rebuttalResponse,
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
            currentAiSpeech,
            generatedPitch: null,
            rebuttalResponse: undefined,
            callScore: undefined
        };
    }
  }
);


export async function runVoiceSalesAgentTurn(input: VoiceSalesAgentFlowInput): Promise<VoiceSalesAgentFlowOutput> {
  const parseResult = VoiceSalesAgentFlowInputSchema.safeParse(input);
  if (!parseResult.success) {
      console.error("Invalid input to runVoiceSalesAgentTurn:", parseResult.error.format());
      throw new Error(`Invalid input for voice agent: ${parseResult.error.format()}`);
  }
  return await voiceSalesAgentFlow(input);
}
