
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation and speech synthesis.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  SynthesizeSpeechOutput,
  RebuttalGeneratorActivityDetails,
  GenerateRebuttalOutput,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal } from './rebuttal-generator';
import { synthesizeSpeech } from './speech-synthesis-flow';
import { scoreCall } from './call-scoring';
import { z } from 'zod';


// Internal helper to select the next part of the pitch
const getNextPitchSection = (
  pitch: GeneratePitchOutput,
  conversationHistory: any[]
): { text: string; isFinal: boolean } => {
  const spokenSections = new Set(
    conversationHistory.map((turn) => turn.pitchSection).filter(Boolean)
  );

  if (!spokenSections.has('productExplanation')) {
    return { text: pitch.productExplanation, isFinal: false };
  }
  if (!spokenSections.has('keyBenefitsAndBundles')) {
    return { text: pitch.keyBenefitsAndBundles, isFinal: false };
  }
  if (!spokenSections.has('discountOrDealExplanation')) {
    return { text: pitch.discountOrDealExplanation, isFinal: false };
  }
  if (!spokenSections.has('objectionHandlingPreviews')) {
    return { text: pitch.objectionHandlingPreviews, isFinal: false };
  }
  if (!spokenSections.has('finalCallToAction')) {
    return { text: pitch.finalCallToAction, isFinal: true };
  }

  // If all main sections are done, provide a polite closing.
  return {
    text: "Is there anything else I can help you with today regarding this offer?",
    isFinal: true,
  };
};

const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
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
      voiceProfileId,
    } = flowInput;

    let currentAiSpeech: SynthesizeSpeechOutput | undefined;
    let generatedPitch: GeneratePitchOutput | null = currentPitchState;
    let rebuttalResponse: GenerateRebuttalOutput | undefined;
    let nextExpectedAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined;

    try {
      if (action === 'START_CONVERSATION') {
        const pitchInput = {
          product, customerCohort, etPlanConfiguration, knowledgeBaseContext,
          salesPlan, offer, agentName, userName, brandName
        };
        generatedPitch = await generatePitch(pitchInput);

        if (generatedPitch.pitchTitle.includes("Failed")) {
          currentAiSpeech = await synthesizeSpeech({
            textToSpeak: `I'm sorry, I couldn't generate a pitch due to an internal error: ${generatedPitch.warmIntroduction}`,
            voiceProfileId,
          });
          nextExpectedAction = 'END_CALL_NO_SCORE';
        } else {
          // Speak the intro and the hook together for a stronger opening
          const openingText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: openingText, voiceProfileId });
        }
      } else if (action === 'PROCESS_USER_RESPONSE') {
        if (!generatedPitch) throw new Error("Pitch state is missing, cannot continue conversation.");
        
        const nextSection = getNextPitchSection(generatedPitch, conversationHistory);
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextSection.text, voiceProfileId });
        
        if (nextSection.isFinal) {
           nextExpectedAction = 'END_CALL';
        }
      } else if (action === 'GET_REBUTTAL') {
          if (!currentUserInputText) throw new Error("User input text not provided for rebuttal.");
          
          rebuttalResponse = await generateRebuttal({
              objection: currentUserInputText,
              product: product,
              knowledgeBaseContext: knowledgeBaseContext
          });

          if (rebuttalResponse.rebuttal.startsWith("Cannot generate")) {
              currentAiSpeech = await synthesizeSpeech({ textToSpeak: "I understand. Is there anything else I can clarify for you about the product?", voiceProfileId });
          } else {
              currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalResponse.rebuttal, voiceProfileId });
          }
      } else if (action === 'END_CALL_AND_SCORE') {
        
        const fullTranscriptText = conversationHistory.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
        
        const scoreOutput = await scoreCall({
            audioDataUri: "dummy-uri-for-text-based-scoring",
            product: product,
            agentName: agentName,
        }, fullTranscriptText);
        
         const closingMessage = `Thank you for your time, ${userName || 'sir/ma\'am'}. Have a great day.`;
         currentAiSpeech = await synthesizeSpeech({ textToSpeak: closingMessage, voiceProfileId });

        return {
          conversationTurns: conversationHistory,
          currentAiSpeech: currentAiSpeech,
          generatedPitch: generatedPitch,
          callScore: scoreOutput,
          nextExpectedAction: 'CALL_SCORED',
        };
      }

      const updatedConversation = currentAiSpeech?.text 
        ? [...conversationHistory, { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri }] 
        : conversationHistory;


      return {
        conversationTurns: updatedConversation,
        currentAiSpeech,
        generatedPitch,
        rebuttalResponse,
        nextExpectedAction,
        errorMessage
      };

    } catch (e: any) {
      console.error("Error in runVoiceSalesAgentTurn:", e);
      errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
      currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId });
      return {
        conversationTurns: conversationHistory,
        currentAiSpeech,
        nextExpectedAction: "END_CALL_NO_SCORE",
        errorMessage: e.message,
        generatedPitch,
      };
    }
  }
);


export { runVoiceSalesAgentTurn };
