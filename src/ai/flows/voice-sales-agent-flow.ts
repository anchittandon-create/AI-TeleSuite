
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

/**
 * A robust, production-grade sanitization function for TTS input.
 * It handles undefined/null/empty strings, strips problematic characters,
 * and clamps the length to a safe range for TTS models.
 * @param text The text to sanitize.
 * @returns A safe, sanitized string for TTS processing.
 */
const sanitizeTextForTTS = (text: string | undefined | null): string => {
    const SAFE_FALLBACK = "I'm here to help you today. How may I assist you?";
    const MIN_LENGTH = 5;
    const MAX_LENGTH = 4500;

    if (!text || text.trim().length < MIN_LENGTH || text.toLowerCase().includes("undefined")) {
        return SAFE_FALLBACK;
    }

    // Strip newlines, carriage returns, double quotes, and ampersands.
    let sanitizedText = text.replace(/[\n\r"&]/g, ' ').replace(/\s+/g, ' ').trim();

    // Clamp the length to be within the safe min/max bounds.
    if (sanitizedText.length > MAX_LENGTH) {
        sanitizedText = sanitizedText.substring(0, MAX_LENGTH);
    }
    
    // If after all sanitization, the string is too short, use fallback.
    if (sanitizedText.length < MIN_LENGTH) {
        return SAFE_FALLBACK;
    }

    return sanitizedText;
};


export const runVoiceSalesAgentTurn = ai.defineFlow(
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
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: sanitizeTextForTTS(pitchErrorMessage), voiceProfileId: flowInput.voiceProfileId });
                return { conversationTurns: newConversationTurns, nextExpectedAction: "END_CALL_NO_SCORE", errorMessage: pitchErrorMessage, currentAiSpeech, generatedPitch: null, rebuttalResponse: undefined, callScore: undefined };
            }

            currentPitch = generatedPitch;
            const initialText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
            
            addTurn("AI", initialText);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: sanitizeTextForTTS(initialText), voiceProfileId: flowInput.voiceProfileId });
            
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
            let nextSectionKey = pitchSectionsInOrder.find(sectionKey => 
                sectionKey && sectionKey.length > 5 && !allPreviousAiTurnsText.some(deliveredText => deliveredText.toLowerCase().includes(sectionKey))
            );

            if (nextSectionKey && fullPitchTextMap[nextSectionKey as keyof typeof fullPitchTextMap]) {
                nextResponseText = fullPitchTextMap[nextSectionKey as keyof typeof fullPitchTextMap];
                if (nextSectionKey === pitchSectionsInOrder[5]) { // If it's the last part (CTA)
                    nextAction = 'END_CALL';
                }
            } else {
                nextResponseText = `Is there anything else I can help you with regarding the ${flowInput.productDisplayName} subscription? Or shall we proceed with the offer?`;
                nextAction = 'END_CALL';
            }
            
            addTurn("AI", nextResponseText);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: sanitizeTextForTTS(nextResponseText), voiceProfileId: flowInput.voiceProfileId });

        } else if (flowInput.action === "GET_REBUTTAL") {
            if (!flowInput.currentUserInputText) throw new Error("Objection text not provided for rebuttal.");
            const rebuttalResult = await generateRebuttal({
                objection: flowInput.currentUserInputText,
                product: flowInput.product,
                knowledgeBaseContext: flowInput.knowledgeBaseContext
            });
            rebuttalResponse = rebuttalResult.rebuttal;
            addTurn("AI", rebuttalResponse);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: sanitizeTextForTTS(rebuttalResponse), voiceProfileId: flowInput.voiceProfileId });

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = [...flowInput.conversationHistory, ...newConversationTurns].map(t => `${t.speaker}: ${t.text}`).join('\n');
            
            callScore = await scoreCall({
                audioDataUri: "dummy-uri-for-text-scoring",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
            
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day!`;
            addTurn("AI", closingMessage);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: sanitizeTextForTTS(closingMessage), voiceProfileId: flowInput.voiceProfileId });
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
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: sanitizeTextForTTS(errorMessage), voiceProfileId: flowInput.voiceProfileId });
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
