
'use server';
/**
 * @fileOverview Orchestrates a Browser Voice Sales Agent conversation.
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation but does NOT handle speech synthesis.
 * It returns text to be spoken by the client's browser TTS.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  BrowserVoiceAgentFlowInput,
  BrowserVoiceAgentFlowOutput,
  BrowserVoiceAgentFlowInputSchema,
  BrowserVoiceAgentFlowOutputSchema,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal } from './rebuttal-generator';
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

const runBrowserVoiceAgentTurn = ai.defineFlow(
  {
    name: 'runBrowserVoiceAgentTurn',
    inputSchema: BrowserVoiceAgentFlowInputSchema,
    outputSchema: BrowserVoiceAgentFlowOutputSchema,
  },
  async (flowInput): Promise<BrowserVoiceAgentFlowOutput> => {
    let {
      action,
      product,
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
    } = flowInput;

    let currentAiResponseText: string | undefined;
    let generatedPitch: GeneratePitchOutput | null = currentPitchState;
    let nextExpectedAction: BrowserVoiceAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined;

    try {
      if (action === 'START_CONVERSATION') {
        const pitchInput = { product, customerCohort, etPlanConfiguration, knowledgeBaseContext, salesPlan, offer, agentName, userName };
        generatedPitch = await generatePitch(pitchInput);

        if (generatedPitch.pitchTitle.includes("Failed")) {
          currentAiResponseText = `I'm sorry, I couldn't generate a pitch due to an internal error: ${generatedPitch.warmIntroduction}`;
          nextExpectedAction = 'END_CALL_NO_SCORE';
        } else {
          currentAiResponseText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
        }
      } else if (action === 'PROCESS_USER_RESPONSE') {
        if (!generatedPitch) throw new Error("Pitch state is missing, cannot continue conversation.");
        
        const nextSection = getNextPitchSection(generatedPitch, conversationHistory);
        currentAiResponseText = nextSection.text;
        
        if (nextSection.isFinal) {
           nextExpectedAction = 'END_CALL';
        }
      } else if (action === 'GET_REBUTTAL') {
          if (!currentUserInputText) throw new Error("User input text not provided for rebuttal.");
          
          const rebuttalResponse = await generateRebuttal({
              objection: currentUserInputText,
              product: product,
              knowledgeBaseContext: knowledgeBaseContext
          });

          if (rebuttalResponse.rebuttal.startsWith("Cannot generate")) {
              currentAiResponseText = "I understand. Is there anything else I can clarify for you about the product?";
          } else {
              currentAiResponseText = rebuttalResponse.rebuttal;
          }
      } else if (action === 'END_CALL_AND_SCORE') {
        
        const fullTranscriptText = conversationHistory.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
        
        const scoreOutput = await scoreCall({
            audioDataUri: "dummy-uri-for-text-based-scoring",
            product: product,
            agentName: agentName,
        }, fullTranscriptText);
        
         const closingMessage = `Thank you for your time, ${userName || 'sir/ma\'am'}. Have a great day.`;
         currentAiResponseText = closingMessage;

        return {
          conversationTurns: conversationHistory,
          currentAiResponseText: currentAiResponseText,
          generatedPitch: generatedPitch,
          callScore: scoreOutput,
          nextExpectedAction: 'CALL_SCORED',
        };
      }

      const updatedConversation = currentAiResponseText 
        ? [...conversationHistory, { id: `ai-${Date.now()}`, speaker: 'AI' as const, text: currentAiResponseText, timestamp: new Date().toISOString() }] 
        : conversationHistory;


      return {
        conversationTurns: updatedConversation,
        currentAiResponseText,
        generatedPitch,
        nextExpectedAction,
        errorMessage
      };

    } catch (e: any) {
      console.error("Error in runBrowserVoiceAgentTurn:", e);
      errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
      currentAiResponseText = errorMessage;
      return {
        conversationTurns: conversationHistory,
        currentAiResponseText,
        nextExpectedAction: "END_CALL_NO_SCORE",
        errorMessage: e.message,
        generatedPitch,
      };
    }
  }
);


export { runBrowserVoiceAgentTurn };
