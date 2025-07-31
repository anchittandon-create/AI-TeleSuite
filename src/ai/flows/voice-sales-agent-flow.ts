
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
  SynthesizeSpeechOutput,
  GenerateRebuttalOutput,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { synthesizeSpeech } from './speech-synthesis-flow';
import { scoreCall } from './call-scoring';
import { generateRebuttal } from './rebuttal-generator';
import { z } from 'zod';


// This function determines the next logical part of the pitch to present.
const getNextPitchSection = (
  pitch: GeneratePitchOutput,
  history: ConversationTurn[]
): { key: keyof GeneratePitchOutput; text: string } | null => {
  const spokenSections: (keyof GeneratePitchOutput)[] = [];
  history.forEach(turn => {
    if (turn.speaker === 'AI') {
      if (turn.text.includes(pitch.productExplanation)) spokenSections.push('productExplanation');
      if (turn.text.includes(pitch.keyBenefitsAndBundles)) spokenSections.push('keyBenefitsAndBundles');
      if (turn.text.includes(pitch.discountOrDealExplanation)) spokenSections.push('discountOrDealExplanation');
      if (turn.text.includes(pitch.objectionHandlingPreviews)) spokenSections.push('objectionHandlingPreviews');
      if (turn.text.includes(pitch.finalCallToAction)) spokenSections.push('finalCallToAction');
    }
  });

  const pitchOrder: (keyof GeneratePitchOutput)[] = [
    'productExplanation',
    'keyBenefitsAndBundles',
    'discountOrDealExplanation',
    'objectionHandlingPreviews',
    'finalCallToAction',
  ];
  
  for (const sectionKey of pitchOrder) {
    if (!spokenSections.includes(sectionKey) && pitch[sectionKey]) {
      const text = pitch[sectionKey] as string;
      if(text.trim()){
         return { key: sectionKey, text: text };
      }
    }
  }

  return null; // All sections have been spoken
};


export const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput, ttsOverride? : (input: any) => Promise<SynthesizeSpeechOutput>): Promise<VoiceSalesAgentFlowOutput> => {
    let newConversationTurns: ConversationTurn[] = [];
    let currentPitch: GeneratePitchOutput | null = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeech;
    let callScore: ScoreCallOutput | undefined;
    let errorMessage: string | undefined;
    let rebuttalResponse: GenerateRebuttalOutput | undefined;


    const ttsFunction = ttsOverride || synthesizeSpeech;

    const addTurn = (speaker: 'AI' | 'User', text: string, audioDataUri?: string) => {
        const newTurn: ConversationTurn = { id: `turn-${Date.now()}-${Math.random()}`, speaker, text, timestamp: new Date().toISOString(), audioDataUri };
        newConversationTurns.push(newTurn);
    };

    try {
        if (flowInput.action === "START_CONVERSATION") {
            const [ttsResult, pitchResult] = await Promise.all([
                 ttsFunction({ textToSpeak: "Please wait while I prepare your tailored pitch.", voiceProfileId: flowInput.voiceProfileId }),
                 generatePitch({
                    product: flowInput.product, customerCohort: flowInput.customerCohort,
                    etPlanConfiguration: flowInput.etPlanConfiguration, salesPlan: flowInput.salesPlan,
                    offer: flowInput.offer, agentName: flowInput.agentName, userName: flowInput.userName,
                    knowledgeBaseContext: flowInput.knowledgeBaseContext,
                })
            ]);
            
            currentPitch = pitchResult;
            if (currentPitch.pitchTitle.includes("Failed")) {
                 throw new Error(`Pitch Generation Failed: ${currentPitch.warmIntroduction}`);
            }

            const initialText = `${currentPitch.warmIntroduction} ${currentPitch.personalizedHook}`;
            currentAiSpeech = await ttsFunction({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });
            
            if(currentAiSpeech.errorMessage) throw new Error(`[TTS Startup Error]: ${currentAiSpeech.errorMessage}`);
            addTurn("AI", initialText, currentAiSpeech.audioDataUri);
            
        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!flowInput.currentUserInputText) throw new Error("User input text not provided for processing.");
            if (!currentPitch) throw new Error("Pitch state is missing from the flow input. Cannot continue conversation.");

            const nextSection = getNextPitchSection(currentPitch, flowInput.conversationHistory);
            
            let nextResponseText = "";
            if (nextSection) {
                nextResponseText = nextSection.text;
                nextAction = nextSection.key === 'finalCallToAction' ? 'END_CALL' : 'USER_RESPONSE';
            } else {
                nextResponseText = `Is there anything else I can help you with regarding the ${flowInput.productDisplayName}?`;
                nextAction = 'END_CALL';
            }
            
            currentAiSpeech = await ttsFunction({ textToSpeak: nextResponseText, voiceProfileId: flowInput.voiceProfileId });
            if(currentAiSpeech.errorMessage) throw new Error(`[TTS Response Error]: ${currentAiSpeech.errorMessage}`);
            addTurn("AI", nextResponseText, currentAiSpeech.audioDataUri);

        } else if (flowInput.action === "GET_REBUTTAL") {
            if (!flowInput.currentUserInputText) throw new Error("User input text not provided for rebuttal.");
             rebuttalResponse = await generateRebuttal({
                objection: flowInput.currentUserInputText,
                product: flowInput.product,
                knowledgeBaseContext: flowInput.knowledgeBaseContext
            });

            if (rebuttalResponse.rebuttal.startsWith("Cannot generate rebuttal:")) {
                throw new Error(rebuttalResponse.rebuttal);
            }
            
            currentAiSpeech = await ttsFunction({ textToSpeak: rebuttalResponse.rebuttal, voiceProfileId: flowInput.voiceProfileId });
            if(currentAiSpeech.errorMessage) throw new Error(`[TTS Rebuttal Error]: ${currentAiSpeech.errorMessage}`);
            addTurn("AI", rebuttalResponse.rebuttal, currentAiSpeech.audioDataUri);

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const fullTranscript = flowInput.conversationHistory.map(t => `${t.speaker}: ${t.text}`).join('\n');
            
            callScore = await scoreCall({
                audioDataUri: "dummy-uri-for-text-scoring",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, fullTranscript);
            
            const closingMessage = `Thank you for your time, ${flowInput.userName || 'sir/ma\'am'}. Have a great day!`;
            currentAiSpeech = await ttsFunction({ textToSpeak: closingMessage, voiceProfileId: flowInput.voiceProfileId });
            if(currentAiSpeech.errorMessage) throw new Error(`[TTS Closing Error]: ${currentAiSpeech.errorMessage}`);
            addTurn("AI", closingMessage, currentAiSpeech.audioDataUri);
            nextAction = "CALL_SCORED";
        }
        
        return {
            conversationTurns: newConversationTurns,
            currentAiSpeech,
            generatedPitch: currentPitch,
            rebuttalResponse: rebuttalResponse?.rebuttal,
            callScore,
            nextExpectedAction: nextAction,
            errorMessage
        };

    } catch (e: any) {
        console.error("Error in voiceSalesAgentFlow:", e);
        errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
        try {
            currentAiSpeech = await ttsFunction({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId });
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
