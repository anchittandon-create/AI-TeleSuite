
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation (now standardized with Browser Agent logic).
 * This flow manages the state of a sales call, from initiation to scoring.
 * It uses other flows like pitch generation and relies on the app's main TTS API route for speech synthesis.
 */

import { ai } from '@/ai/genkit';
import {
  GeneratePitchOutput,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  VoiceSalesAgentFlowInputSchema,
  VoiceSalesAgentFlowOutputSchema,
  scoreCall,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal } from './rebuttal-generator';
import { synthesizeSpeech } from './speech-synthesis-flow';
import { z } from 'zod';

const getNextPitchSection = (
  pitch: GeneratePitchOutput,
  history: any[]
): { text: string; isFinal: boolean } => {
  const spokenSections = new Set(history.map(turn => turn.pitchSection).filter(Boolean));

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
  return { text: pitch.finalCallToAction, isFinal: true };
};


const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPrompt',
    input: { schema: z.object({
        productDisplayName: z.string(),
        conversationHistory: z.string(),
        lastUserResponse: z.string(),
        knowledgeBaseContext: z.string(),
    }) },
    output: { schema: z.object({
        decision: z.enum(["CONTINUE_PITCH", "ANSWER_QUESTION", "REBUTTAL", "CLOSING_STATEMENT"]),
        reasoning: z.string(),
    })},
    prompt: `You are an AI sales agent controller. Analyze the last user response in the context of the conversation history. Decide the next action.

Conversation History:
{{{conversationHistory}}}

Last User Response: "{{{lastUserResponse}}}"

Knowledge Base Context (for answering questions):
{{{knowledgeBaseContext}}}

Decision Options:
- CONTINUE_PITCH: If the user gives a neutral or positive signal (e.g., "okay", "tell me more", "hmm").
- ANSWER_QUESTION: If the user asks a specific question about the product.
- REBUTTAL: If the user raises an objection or shows hesitation (e.g., "it's too expensive", "I'm not sure").
- CLOSING_STATEMENT: If the conversation is naturally concluding or the user indicates they are ready to decide.

Your decision must be one of the above. Provide a brief reasoning.
`,
});


export const runVoiceSalesAgentTurn = ai.defineFlow(
  {
    name: 'runVoiceSalesAgentTurn',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let currentPitch: GeneratePitchOutput | null = flowInput.currentPitchState;
    let nextAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let currentAiSpeech: VoiceSalesAgentFlowOutput['currentAiSpeech'];
    let rebuttalResponse: VoiceSalesAgentFlowOutput['rebuttalResponse'];
    let callScore: VoiceSalesAgentFlowOutput['callScore'];
    let errorMessage: string | undefined;

    try {
        if (flowInput.action === "START_CONVERSATION") {
            currentPitch = await generatePitch({
                product: flowInput.product,
                customerCohort: flowInput.customerCohort,
                etPlanConfiguration: flowInput.etPlanConfiguration,
                salesPlan: flowInput.salesPlan,
                offer: flowInput.offer,
                agentName: flowInput.agentName,
                userName: flowInput.userName,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            });
            
            if (currentPitch.pitchTitle.includes("Failed")) {
                throw new Error(currentPitch.warmIntroduction);
            }

            const initialText = `${currentPitch.warmIntroduction}\n${currentPitch.personalizedHook}`;
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: initialText, voiceProfileId: flowInput.voiceProfileId });

        } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
            if (!flowInput.currentUserInputText || !currentPitch) throw new Error("User input or pitch state missing.");

            const { output: routerResult } = await conversationRouterPrompt({
                productDisplayName: flowInput.productDisplayName,
                conversationHistory: JSON.stringify(flowInput.conversationHistory),
                lastUserResponse: flowInput.currentUserInputText,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
            });
            
            if (!routerResult) throw new Error("AI router failed to respond.");

            let textToSpeak = "";
            if(routerResult.decision === "ANSWER_QUESTION" || routerResult.decision === "REBUTTAL") {
                rebuttalResponse = await generateRebuttal({
                    objection: flowInput.currentUserInputText,
                    product: flowInput.product,
                    knowledgeBaseContext: flowInput.knowledgeBaseContext
                });
                textToSpeak = rebuttalResponse.rebuttal;
            } else { // CONTINUE_PITCH or CLOSING_STATEMENT
                 const { text, isFinal } = getNextPitchSection(currentPitch, flowInput.conversationHistory);
                 textToSpeak = text;
                 if (isFinal) nextAction = 'END_CALL';
            }
            currentAiSpeech = await synthesizeSpeech({ textToSpeak, voiceProfileId: flowInput.voiceProfileId });

        } else if (flowInput.action === "END_CALL_AND_SCORE") {
            const transcript = flowInput.conversationHistory.map(t => `${t.speaker}: ${t.text}`).join('\n');
            callScore = await scoreCall({
                audioDataUri: "dummy-for-text",
                product: flowInput.product,
                agentName: flowInput.agentName,
            }, transcript);
            
            const closingText = "Thank you for your time. The call has ended.";
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: closingText, voiceProfileId: flowInput.voiceProfileId });
            nextAction = 'CALL_SCORED';
        }
        
        return {
            conversationTurns: [],
            currentAiSpeech,
            generatedPitch: currentPitch,
            rebuttalResponse,
            callScore,
            nextExpectedAction: nextAction,
            errorMessage
        };

    } catch (e: any) {
        console.error("Error in voiceSalesAgentFlow:", e);
        errorMessage = `I'm sorry, I encountered an internal error. Details: ${e.message}`;
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId });
        return {
            conversationTurns: [],
            nextExpectedAction: "END_CALL_NO_SCORE",
            errorMessage: e.message,
            currentAiSpeech,
            generatedPitch: currentPitch,
        };
    }
  }
);
