
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


const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let newConversationTurns: ConversationTurn[] = [];
    let currentPitch = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeech;
    let callScore;
    let rebuttalResponse;
    let errorMessage;

    const addTurn = (speaker: 'AI' | 'User', text: string, audioDataUri?: string) => {
        newConversationTurns.push({ id: `turn-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString(), audioDataUri });
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
                const pitchErrorMessage = generatedPitch.fullPitchScript;
                addTurn("AI", pitchErrorMessage);
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: pitchErrorMessage, voiceProfileId: flowInput.voiceProfileId });
                return { conversationTurns: newConversationTurns, nextExpectedAction: "END_CALL_NO_SCORE", errorMessage: pitchErrorMessage, currentAiSpeech, generatedPitch: null, rebuttalResponse: undefined, callScore: undefined };
            }

            currentPitch = generatedPitch;
            const initialText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
            addTurn("AI", initialText);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!currentPitch) throw new Error("Pitch state is missing for processing user response.");
            
            const allPreviousAiTurnsText = [...flowInput.conversationHistory, ...newConversationTurns]
                .filter(t => t.speaker === 'AI')
                .map(t => t.text.trim().toLowerCase());

            const pitchSectionsInOrder = [
                `${currentPitch.warmIntroduction.trim().toLowerCase()} ${currentPitch.personalizedHook.trim().toLowerCase()}`,
                currentPitch.productExplanation.trim().toLowerCase(),
                currentPitch.keyBenefitsAndBundles.trim().toLowerCase(),
                currentPitch.discountOrDealExplanation.trim().toLowerCase(),
                currentPitch.objectionHandlingPreviews.trim().toLowerCase(),
                currentPitch.finalCallToAction.trim().toLowerCase()
            ];

            const fullPitchTextMap = {
                [pitchSectionsInOrder[0]]: `${currentPitch.warmIntroduction} ${currentPitch.personalizedHook}`,
                [pitchSectionsInOrder[1]]: currentPitch.productExplanation,
                [pitchSectionsInOrder[2]]: currentPitch.keyBenefitsAndBundles,
                [pitchSectionsInOrder[3]]: currentPitch.discountOrDealExplanation,
                [pitchSectionsInOrder[4]]: currentPitch.objectionHandlingPreviews,
                [pitchSectionsInOrder[5]]: currentPitch.finalCallToAction,
            };
            
            let nextResponseText = "";
            let nextSectionToDeliverKey = pitchSectionsInOrder.find(sectionKey => 
                sectionKey && !allPreviousAiTurnsText.some(deliveredText => deliveredText.includes(sectionKey))
            );
            
            if (nextSectionToDeliverKey) {
                nextResponseText = fullPitchTextMap[nextSectionToDeliverKey as keyof typeof fullPitchTextMap] || "";
                if (nextSectionToDeliverKey === pitchSectionsInOrder[5]) {
                    nextAction = 'END_CALL';
                }
            } else {
                nextResponseText = `Is there anything else I can help you with regarding the ${flowInput.productDisplayName} subscription? Or shall we proceed with the offer?`;
                nextAction = 'END_CALL';
            }
            
            if (nextResponseText && nextResponseText.trim()) {
                addTurn("AI", nextResponseText);
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextResponseText, voiceProfileId: flowInput.voiceProfileId });
            } else {
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
            
            callScore = await scoreCall({
                audioDataUri: "dummy-uri-for-text-scoring",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
            
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
        errorMessage = `I'm sorry, I encountered an internal error: ${e.message}. Please try again.`;
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
