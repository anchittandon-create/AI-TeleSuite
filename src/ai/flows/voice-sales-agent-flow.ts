
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * Integrates Pitch Generation, Rebuttal Generation, Transcription (simulated for user input),
 * and Call Scoring. Text-to-speech is handled on the client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  Product,
  SalesPlan,
  CustomerCohort,
  ETPlanConfiguration,
  ConversationTurn,
  GeneratePitchOutput as FullGeneratePitchOutput, 
  ScoreCallOutput,
  SimulatedSpeechOutput,
  ProductObject
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal, GenerateRebuttalInput } from './rebuttal-generator';
import { scoreCall, ScoreCallInput } from './call-scoring';
import { synthesizeSpeech } from './speech-synthesis-flow';


const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.string(),
  productDisplayName: z.string(), // Added for immediate greeting
  salesPlan: z.string().optional(),
  etPlanConfiguration: z.string().optional(),
  offer: z.string().optional(),
  customerCohort: z.string(),
  agentName: z.string().optional(),
  userName: z.string().optional(),
  voiceProfileId: z.string().optional(),
  knowledgeBaseContext: z.string(),
  
  conversationHistory: z.array(z.object({ 
    id: z.string(),
    speaker: z.enum(['AI', 'User']),
    text: z.string(),
    timestamp: z.string(),
    audioDataUri: z.string().optional(),
  })).optional(),
  
  currentUserInputText: z.string().optional(),
  currentPitchState: z.custom<FullGeneratePitchOutput>().optional(),
  
  action: z.enum([
    "START_CONVERSATION", 
    "PROCESS_USER_RESPONSE", 
    "GET_REBUTTAL", 
    "END_CALL_AND_SCORE"
  ]),
});
export type VoiceSalesAgentFlowInput = z.infer<typeof VoiceSalesAgentFlowInputSchema>;


const VoiceSalesAgentFlowOutputSchema = z.object({
    conversationTurns: z.array(z.object({ 
        id: z.string(),
        speaker: z.enum(['AI', 'User']),
        text: z.string(),
        timestamp: z.string(),
        audioDataUri: z.string().optional(),
    })),
    currentAiSpeech: z.custom<SimulatedSpeechOutput>().optional(),
    generatedPitch: z.custom<FullGeneratePitchOutput>().optional(), 
    rebuttalResponse: z.string().optional(),
    callScore: z.custom<ScoreCallOutput>().optional(), 
    nextExpectedAction: z.enum(['USER_RESPONSE', 'GET_REBUTTAL', 'CONTINUE_PITCH', 'END_CALL', 'CALL_SCORED', 'END_CALL_NO_SCORE']), 
    errorMessage: z.string().optional(),
});
export type VoiceSalesAgentFlowOutput = z.infer<typeof VoiceSalesAgentFlowOutputSchema>;


// This complex router prompt is being removed as it was a likely source of failure.
// Simpler, more direct logic will be used in the flow itself.


const voiceSalesAgentFlow = ai.defineFlow(
  {
    name: 'voiceSalesAgentFlow',
    inputSchema: VoiceSalesAgentFlowInputSchema,
  },
  async (flowInput): Promise<VoiceSalesAgentFlowOutput> => {
    let conversationTurns: ConversationTurn[] = flowInput.conversationHistory || [];
    let generatedPitch = flowInput.currentPitchState as FullGeneratePitchOutput | undefined;
    let rebuttalText: string | undefined = undefined;
    let callScoreOutput: ScoreCallOutput | undefined = undefined;
    let nextExpectedAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined = undefined;
    let currentAiSpeech: SimulatedSpeechOutput | undefined = undefined;


    const newTurnId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const addAiTurn = async (text: string): Promise<void> => {
        if (!text) return;
        const speech = await synthesizeSpeech({ 
            textToSpeak: text, 
            voiceProfileId: flowInput.voiceProfileId
        });
        currentAiSpeech = speech;
        conversationTurns.push({ 
            id: newTurnId(), 
            speaker: 'AI', 
            text: text, 
            timestamp: new Date().toISOString(),
            audioDataUri: speech.audioDataUri
        });
    };


    try {
      if (flowInput.action === "START_CONVERSATION") {
        generatedPitch = await generatePitch({
          product: flowInput.product as Product,
          customerCohort: flowInput.customerCohort as CustomerCohort,
          salesPlan: flowInput.salesPlan as SalesPlan,
          offer: flowInput.offer,
          etPlanConfiguration: flowInput.product === "ET" ? flowInput.etPlanConfiguration as ETPlanConfiguration : undefined,
          knowledgeBaseContext: flowInput.knowledgeBaseContext,
          agentName: flowInput.agentName,
          userName: flowInput.userName,
        });

        if (generatedPitch.pitchTitle?.includes("Failed") || generatedPitch.pitchTitle?.includes("Error")) {
            errorMessage = `Pitch generation failed: ${generatedPitch.warmIntroduction}. Details: ${generatedPitch.fullPitchScript}`;
            await addAiTurn(errorMessage);
            nextExpectedAction = "END_CALL_NO_SCORE";
        } else {
            const initialGreeting = `${generatedPitch.warmIntroduction}\n${generatedPitch.personalizedHook}`;
            await addAiTurn(initialGreeting);
            nextExpectedAction = "USER_RESPONSE";
        }

      } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
        if (!generatedPitch || !flowInput.currentUserInputText) {
          errorMessage = "Cannot process response: pitch context or user input is missing.";
          await addAiTurn("I'm sorry, there was a system error. Could you please state your query again?");
          nextExpectedAction = "USER_RESPONSE";
        } else {
            // Simplified logic to continue the pitch
            const deliveredParts = new Set(conversationTurns.map(t => t.text));
            let nextPitchPart = "";

            if (!deliveredParts.has(generatedPitch.productExplanation)) {
              nextPitchPart = generatedPitch.productExplanation;
            } else if (!deliveredParts.has(generatedPitch.keyBenefitsAndBundles)) {
              nextPitchPart = generatedPitch.keyBenefitsAndBundles;
            } else if (!deliveredParts.has(generatedPitch.discountOrDealExplanation)) {
              nextPitchPart = generatedPitch.discountOrDealExplanation;
            } else if (!deliveredParts.has(generatedPitch.objectionHandlingPreviews)) {
              nextPitchPart = generatedPitch.objectionHandlingPreviews;
            } else if (!deliveredParts.has(generatedPitch.finalCallToAction)) {
              nextPitchPart = generatedPitch.finalCallToAction;
            } else {
              nextPitchPart = "Is there anything else I can help you with today?";
            }
            
            await addAiTurn(nextPitchPart);
            nextExpectedAction = "USER_RESPONSE";
        }
      } else if (flowInput.action === "GET_REBUTTAL") {
        if (!flowInput.currentUserInputText) {
          errorMessage = "No user objection text provided to get a rebuttal for.";
          await addAiTurn("I'm sorry, I didn't catch the objection. Could you state it again?");
          nextExpectedAction = "USER_RESPONSE";
        } else {
          const rebuttalInput: GenerateRebuttalInput = {
            objection: flowInput.currentUserInputText,
            product: flowInput.product as Product,
            knowledgeBaseContext: flowInput.knowledgeBaseContext,
          };
          const rebuttalResult = await generateRebuttal(rebuttalInput);
          rebuttalText = rebuttalResult.rebuttal;
          if(rebuttalText.startsWith("Cannot generate rebuttal:") || rebuttalText.startsWith("Error generating rebuttal:")) {
            errorMessage = `Rebuttal generation failed: ${rebuttalText}`;
          }
          await addAiTurn(rebuttalText);
          nextExpectedAction = "USER_RESPONSE"; 
        }
      } else if (flowInput.action === "END_CALL_AND_SCORE") {
        const fullTranscriptText = conversationTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n\n');
        
        const scoreInput: ScoreCallInput = {
          audioDataUri: `data:text/plain;base64,${Buffer.from(fullTranscriptText).toString('base64')}`,
          product: flowInput.product as Product,
          agentName: flowInput.agentName || "AI Agent"
        };
        
        callScoreOutput = await scoreCall(scoreInput); 
        callScoreOutput.transcript = fullTranscriptText; 
        callScoreOutput.transcriptAccuracy = "N/A (from text transcript)"; 

        await addAiTurn("Thank you for your time. This interaction has concluded.");
        nextExpectedAction = "CALL_SCORED";
      }
    } catch (error: any) {
      console.error("Error in VoiceSalesAgentFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      errorMessage = (error.message || "An unexpected error occurred in the sales agent flow.");
      const errorTextToSpeak = `I'm sorry, a system error occurred: ${errorMessage.substring(0,100)}. Please try again later.`;
      await addAiTurn(errorTextToSpeak);
      nextExpectedAction = "END_CALL_NO_SCORE"; 
    }

    return {
      conversationTurns,
      currentAiSpeech,
      generatedPitch: generatedPitch, // Always return the pitch state
      rebuttalResponse: rebuttalText,
      callScore: callScoreOutput,
      nextExpectedAction,
      errorMessage,
    };
  }
);

export async function runVoiceSalesAgentTurn(input: VoiceSalesAgentFlowInput): Promise<VoiceSalesAgentFlowOutput> {
  const parseResult = VoiceSalesAgentFlowInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for runVoiceSalesAgentTurn:", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    const errorText = `Invalid input to sales agent: ${errorMessages.substring(0,150)}`;
    return {
        conversationTurns: input.conversationHistory || [],
        errorMessage: `Invalid input: ${errorMessages}`,
        nextExpectedAction: input.action === "START_CONVERSATION" ? "END_CALL_NO_SCORE" : "USER_RESPONSE",
    };
  }
  
  try {
    return await voiceSalesAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSalesAgentFlow:", error);
    const errorText = `Critical system error in sales agent: ${error.message.substring(0,150)}`;
    return {
      conversationTurns: input.conversationHistory || [],
      errorMessage: `Critical system error: ${error.message}`,
      nextExpectedAction: "END_CALL_NO_SCORE",
    };
  }
}
