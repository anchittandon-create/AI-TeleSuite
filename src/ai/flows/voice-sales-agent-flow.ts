
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * Integrates Pitch Generation, Rebuttal Generation, Transcription (simulated for user input),
 * Speech Synthesis (simulated), and Call Scoring.
 * - runVoiceSalesAgentTurn - Handles a turn in the conversation or initiates it.
 * - VoiceSalesAgentFlowInput - Input type.
 * - VoiceSalesAgentFlowOutput - Output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  Product,
  SalesPlan,
  CustomerCohort,
  ETPlanConfiguration,
  ConversationTurn,
  SimulatedSpeechOutput,
  PRODUCTS,
  SALES_PLANS,
  CUSTOMER_COHORTS,
  ET_PLAN_CONFIGURATIONS,
  ExtendedGeneratePitchInput,
  GeneratePitchOutput as FullGeneratePitchOutput, 
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal, GenerateRebuttalInput } from './rebuttal-generator';
import { synthesizeSpeech, SynthesizeSpeechInput } from './speech-synthesis-flow';
import { scoreCall, ScoreCallInput, ScoreCallOutput } from './call-scoring';
import { transcribeAudio, TranscriptionInput } from './transcription-flow'; 

const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.enum(PRODUCTS),
  salesPlan: z.enum(SALES_PLANS).optional(),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional(),
  offer: z.string().optional(),
  customerCohort: z.enum(CUSTOMER_COHORTS),
  agentName: z.string().optional().describe("Name of the agent making the call (for AI dialogue)."),
  userName: z.string().optional().describe("Name of the customer/user being called."),
  countryCode: z.string().optional().describe("Country code for the user's mobile number."),
  userMobileNumber: z.string().min(1, "User mobile number is required."), 
  voiceProfileId: z.string().optional().describe("Simulated ID of the cloned voice profile."),
  knowledgeBaseContext: z.string().describe("Context from Knowledge Base for pitch and rebuttals."),
  
  conversationHistory: z.array(z.object({ 
    id: z.string(),
    speaker: z.enum(['AI', 'User']),
    text: z.string(),
    timestamp: z.string(),
    audioDataUri: z.string().optional(),
    transcriptionAccuracy: z.string().optional(), 
  })).optional().describe("History of the conversation turns."),
  
  currentUserInputText: z.string().optional().describe("Text of the user's latest response (already transcribed)."),
  currentUserInputAudioDataUri: z.string().optional().describe("Data URI of the user's latest recorded response (if applicable)."),
  
  currentPitchState: z.custom<FullGeneratePitchOutput>().optional().describe("The state of the generated pitch (GeneratePitchOutput), if one exists."),
  
  action: z.enum([
    "START_CONVERSATION", 
    "PROCESS_USER_RESPONSE", 
    "GET_REBUTTAL", 
    "END_CALL_AND_SCORE"
  ]).describe("The specific action to take in this turn.")
});
export type VoiceSalesAgentFlowInput = z.infer<typeof VoiceSalesAgentFlowInputSchema>;


const VoiceSalesAgentFlowOutputSchema = z.object({
    conversationTurns: z.array(z.object({ 
        id: z.string(),
        speaker: z.enum(['AI', 'User']),
        text: z.string(),
        timestamp: z.string(),
        audioDataUri: z.string().optional(),
        transcriptionAccuracy: z.string().optional(), 
    })),
    currentAiSpeech: z.object({
        text: z.string(),
        audioDataUri: z.string().optional(),
        voiceProfileId: z.string().optional(),
        errorMessage: z.string().optional(),
    }).optional(),
    generatedPitch: z.custom<FullGeneratePitchOutput>().optional(), 
    rebuttalResponse: z.string().optional(),
    callScore: z.custom<ScoreCallOutput>().optional(), 
    nextExpectedAction: z.enum(['USER_RESPONSE', 'GET_REBUTTAL', 'CONTINUE_PITCH', 'END_CALL', 'CALL_SCORED', 'END_CALL_NO_SCORE']), 
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
    let conversationTurns: ConversationTurn[] = flowInput.conversationHistory || [];
    let currentAiSpeech: SimulatedSpeechOutput | undefined = undefined;
    let generatedPitch = flowInput.currentPitchState as FullGeneratePitchOutput | null;
    let rebuttalText: string | undefined = undefined;
    let callScoreOutput: ScoreCallOutput | undefined = undefined;
    let nextExpectedAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined = undefined;

    const newTurnId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      if (flowInput.action === "START_CONVERSATION") {
        const pitchInput: ExtendedGeneratePitchInput = {
          product: flowInput.product,
          customerCohort: flowInput.customerCohort,
          salesPlan: flowInput.salesPlan,
          offer: flowInput.offer,
          etPlanConfiguration: flowInput.product === "ET" ? flowInput.etPlanConfiguration : undefined,
          knowledgeBaseContext: flowInput.knowledgeBaseContext,
          agentName: flowInput.agentName,
          userName: flowInput.userName,
        };
        generatedPitch = await generatePitch(pitchInput);

        if (generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed") || generatedPitch.pitchTitle?.startsWith("Pitch Generation Error") || generatedPitch.pitchTitle?.startsWith("Pitch Generation Aborted")) {
            errorMessage = generatedPitch.warmIntroduction || generatedPitch.fullPitchScript || "Failed to generate initial sales pitch due to KB or AI service issues.";
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            nextExpectedAction = "END_CALL_NO_SCORE"; 
        } else {
            const firstAiText = `${generatedPitch.warmIntroduction || ""} ${generatedPitch.personalizedHook || ""}`.trim();
            if (firstAiText) {
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: firstAiText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            } else {
                 errorMessage = "The initial parts of the pitch (introduction/hook) could not be generated. Please check KB.";
                 currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                 conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                 nextExpectedAction = "END_CALL_NO_SCORE";
            }
            nextExpectedAction = "USER_RESPONSE";
        }
      } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
        if (!generatedPitch) {
            errorMessage = "Cannot process user response: No pitch has been generated or the initial pitch failed.";
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            nextExpectedAction = "END_CALL_NO_SCORE";
        } else {
            let userText = flowInput.currentUserInputText;
            let userTurnAccuracy: string | undefined = undefined;

            if (flowInput.currentUserInputAudioDataUri && !userText) {
                const transcriptionResult = await transcribeAudio({ audioDataUri: flowInput.currentUserInputAudioDataUri });
                userTurnAccuracy = transcriptionResult.accuracyAssessment;
                if (transcriptionResult.diarizedTranscript && !transcriptionResult.diarizedTranscript.startsWith("[")) { 
                    userText = transcriptionResult.diarizedTranscript; 
                } else {
                    userText = transcriptionResult.diarizedTranscript || "[Audio input unclear or transcription failed]"; // Ensure userText gets error string
                }
                 // User turn already added by UI for audio input, no need to re-add here
            } else if (userText) {
                // User turn from text input was added by UI
            }

            if (userText) {
                if (userText.toLowerCase().startsWith("[transcription failed") || userText.toLowerCase().startsWith("[audio input unclear")) {
                    const transcriptionErrorText = `I'm sorry, I had trouble understanding your last response. The system reported: "${userText}". Could you please try speaking again, or perhaps type your response if that's easier?`;
                    currentAiSpeech = await synthesizeSpeech({ textToSpeak: transcriptionErrorText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                    conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                    nextExpectedAction = "USER_RESPONSE";
                } else {
                    const pitchParts = [
                        generatedPitch.productExplanation,
                        generatedPitch.keyBenefitsAndBundles,
                        generatedPitch.discountOrDealExplanation,
                        generatedPitch.objectionHandlingPreviews, 
                        generatedPitch.finalCallToAction,
                    ].filter((part): part is string => typeof part === 'string' && part.trim() !== "" && !part.toLowerCase().includes("kb content insufficient") && !part.toLowerCase().includes("would go here") && !part.toLowerCase().includes("error"));

                    if (pitchParts.length === 0) {
                        const pitchProblemText = `I seem to be having trouble constructing the next part of our discussion due to issues with the pitch content, possibly from the Knowledge Base. Let's try a different approach. What are your current thoughts on ${flowInput.product}? Or is there anything specific you'd like to know?`;
                        currentAiSpeech = await synthesizeSpeech({ textToSpeak: pitchProblemText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                        conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                        nextExpectedAction = "USER_RESPONSE";
                    } else {
                        let lastAIPitchContent = "";
                        for (let i = conversationTurns.length - 1; i >= 0; i--) {
                            const turn = conversationTurns[i];
                            if (turn.speaker === 'AI' &&
                                generatedPitch && // Ensure generatedPitch is not null
                                turn.text && // Ensure turn.text is not null/undefined
                                generatedPitch.warmIntroduction && !turn.text.includes(generatedPitch.warmIntroduction) &&
                                generatedPitch.personalizedHook && !turn.text.includes(generatedPitch.personalizedHook) &&
                                pitchParts.some(pp => turn.text.includes(pp.substring(0, Math.min(pp.length, 30))))) {
                                lastAIPitchContent = turn.text;
                                break;
                            }
                        }
                        
                        let currentPartIndexInPitch = -1;
                        if(lastAIPitchContent) {
                            currentPartIndexInPitch = pitchParts.findIndex(part => lastAIPitchContent.includes(part.substring(0, Math.min(part.length, 30) )) );
                        }
                        
                        let nextPitchPartIndex = currentPartIndexInPitch + 1;
                        let nextAiText = ""; 
                        
                        if (nextPitchPartIndex < pitchParts.length) { 
                            nextAiText = pitchParts[nextPitchPartIndex];
                            if (nextAiText === generatedPitch.finalCallToAction || nextPitchPartIndex === pitchParts.length -1) {
                                nextExpectedAction = "END_CALL_AND_SCORE"; 
                            } else {
                                nextExpectedAction = "USER_RESPONSE";
                            }
                        } else { 
                            nextAiText = generatedPitch.finalCallToAction || "Is there anything else I can help you with regarding this offer today?";
                            nextExpectedAction = "END_CALL_AND_SCORE"; 
                        }
                        
                        currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextAiText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                        conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                    }
                }
            } else {
                 errorMessage = "No user input text to process for response.";
                 currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                 conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                 nextExpectedAction = "USER_RESPONSE"; 
            }
        }
      } else if (flowInput.action === "GET_REBUTTAL") {
        if (!flowInput.currentUserInputText) {
          errorMessage = "No user objection text provided to get a rebuttal for.";
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
          nextExpectedAction = "USER_RESPONSE";
        } else {
          const rebuttalInput: GenerateRebuttalInput = {
            objection: flowInput.currentUserInputText,
            product: flowInput.product,
            knowledgeBaseContext: flowInput.knowledgeBaseContext,
          };
          const rebuttalResult = await generateRebuttal(rebuttalInput);
          rebuttalText = rebuttalResult.rebuttal;
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
          nextExpectedAction = "USER_RESPONSE"; 
        }
        if (currentAiSpeech) {
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
        }
      } else if (flowInput.action === "END_CALL_AND_SCORE") {
        const fullTranscriptText = conversationTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n\n');
        
        if (fullTranscriptText.length < 20 || conversationTurns.filter(t=>t.speaker === 'User').length === 0) { 
            callScoreOutput = { 
                transcript: fullTranscriptText || "[No meaningful conversation recorded]",
                transcriptAccuracy: "N/A (call too short or no user interaction)",
                overallScore: 0, 
                callCategorisation: "Error", 
                metricScores:[{metric: "Call Length/Interaction", score: 1, feedback: "Call too short or no meaningful user interaction to score."}], 
                summary: "Call too short or insufficient interaction for scoring.", 
                strengths:[], 
                areasForImprovement:[] 
            };
        } else {
            const dummyAudioForScoring = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; 
            const scoreInput: ScoreCallInput = {
              audioDataUri: dummyAudioForScoring, 
              product: flowInput.product,
              agentName: flowInput.agentName || "AI Agent"
            };
            
             callScoreOutput = await scoreCall(scoreInput); 
             callScoreOutput.transcript = fullTranscriptText; 
             callScoreOutput.transcriptAccuracy = "Aggregated from turns (primarily text-based)"; 
        }
        const endCallText = "Thank you for your time. This interaction has now concluded.";
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: endCallText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
        if (conversationTurns.length === 0 || conversationTurns[conversationTurns.length - 1].text !== endCallText) {
          conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
        }
        nextExpectedAction = "CALL_SCORED";
      }
    } catch (error: any) {
      console.error("Error in VoiceSalesAgentFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      errorMessage = error.message || "An unexpected error occurred in the sales agent flow.";
      if (!currentAiSpeech) { // Ensure there's always some AI speech even on catastrophic error
        const errorTextToSpeak = `I'm sorry, a system error occurred: ${errorMessage.substring(0,100)}. Please try again later.`;
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorTextToSpeak, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
        conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
      }
      nextExpectedAction = "END_CALL_NO_SCORE"; 
    }

    return {
      conversationTurns,
      currentAiSpeech,
      generatedPitch: (flowInput.action === "START_CONVERSATION" && generatedPitch && !(generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed"))) ? generatedPitch : undefined,
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
    const fallbackSpeech = await synthesizeSpeech({textToSpeak: errorText, voiceProfileId: input.voiceProfileId, languageCode: 'en-IN'});
    return {
        conversationTurns: input.conversationHistory || [],
        currentAiSpeech: fallbackSpeech,
        errorMessage: `Invalid input: ${errorMessages}`,
        nextExpectedAction: input.action === "START_CONVERSATION" ? "END_CALL_NO_SCORE" : input.conversationHistory ? "USER_RESPONSE" : "END_CALL_NO_SCORE",
    };
  }
  
  try {
    return await voiceSalesAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSalesAgentFlow:", error);
    const errorText = `Critical system error in sales agent: ${error.message.substring(0,150)}`;
    const fallbackSpeech = await synthesizeSpeech({textToSpeak: errorText, voiceProfileId: input.voiceProfileId, languageCode: 'en-IN'});
    return {
      conversationTurns: input.conversationHistory || [],
      currentAiSpeech: fallbackSpeech,
      errorMessage: `Critical system error: ${error.message}`,
      nextExpectedAction: "END_CALL_NO_SCORE",
    };
  }
}

