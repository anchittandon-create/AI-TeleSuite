
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Sales Agent conversation.
 * Integrates Pitch Generation, Rebuttal Generation, Transcription (simulated for user input),
 * Speech Synthesis (simulated), and Call Scoring.
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
  ScoreCallOutput,
} from '@/types';
import { generatePitch } from './pitch-generator';
import { generateRebuttal, GenerateRebuttalInput } from './rebuttal-generator';
import { synthesizeSpeech, SynthesizeSpeechInput } from './speech-synthesis-flow';
import { scoreCall, ScoreCallInput } from './call-scoring';
import { transcribeAudio, TranscriptionInput } from './transcription-flow'; 

const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.enum(PRODUCTS),
  salesPlan: z.enum(SALES_PLANS).optional(),
  etPlanConfiguration: z.enum(ET_PLAN_CONFIGURATIONS).optional(),
  offer: z.string().optional(),
  customerCohort: z.enum(CUSTOMER_COHORTS),
  agentName: z.string().optional().describe("Name of the agent making the call (for AI dialogue)."),
  userName: z.string().optional().describe("Name of the customer/user being called."),
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
        audioDataUri: z.string().optional(), // AI turns will have it (placeholder or real)
        transcriptionAccuracy: z.string().optional(), 
    })),
    currentAiSpeech: z.object({
        text: z.string(),
        audioDataUri: z.string(), // Now non-optional from synthesizeSpeech
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
    let generatedPitch = flowInput.currentPitchState as FullGeneratePitchOutput | undefined;
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
            console.warn("VoiceSalesAgentFlow: Initial pitch generation failed.", errorMessage);
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
            if (currentAiSpeech.errorMessage && !errorMessage) errorMessage = `Speech synthesis error: ${currentAiSpeech.errorMessage}`;
            else if (currentAiSpeech.errorMessage) errorMessage += ` | Speech synthesis error: ${currentAiSpeech.errorMessage}`;

            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            nextExpectedAction = "END_CALL_NO_SCORE"; 
        } else {
            const firstAiText = `${generatedPitch.warmIntroduction || ""} ${generatedPitch.personalizedHook || ""}`.trim();
            if (firstAiText) {
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: firstAiText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for intro/hook: ${currentAiSpeech.errorMessage}`;
                conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                nextExpectedAction = "USER_RESPONSE";
            } else {
                 errorMessage = "The initial parts of the pitch (introduction/hook) could not be generated. Please check Knowledge Base.";
                 console.warn("VoiceSalesAgentFlow: Initial pitch parts (intro/hook) missing from successfully generated pitch structure.");
                 currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorMessage, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                 if (currentAiSpeech.errorMessage && !errorMessage) errorMessage = `Speech synthesis error: ${currentAiSpeech.errorMessage}`;
                 else if (currentAiSpeech.errorMessage) errorMessage += ` | Speech synthesis error: ${currentAiSpeech.errorMessage}`;
                 conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                 nextExpectedAction = "END_CALL_NO_SCORE";
            }
        }
      } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
        if (!generatedPitch || generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed") || generatedPitch.pitchTitle?.startsWith("Pitch Generation Error") || generatedPitch.pitchTitle?.startsWith("Pitch Generation Aborted")) {
            errorMessage = "Cannot process user response: The sales pitch context is missing or was not generated successfully. The interaction cannot continue along the planned pitch.";
            console.warn("VoiceSalesAgentFlow: PROCESS_USER_RESPONSE called with invalid or missing pitch context.");
            const recoveryText = "I'm sorry, I seem to have lost my place in our discussion. Could you remind me what we were talking about, or would you like to start over?";
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: recoveryText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
            if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for recovery: ${currentAiSpeech.errorMessage}`;
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            nextExpectedAction = "USER_RESPONSE"; 
        } else {
            let userText = flowInput.currentUserInputText;
            
            if (!userText) {
                 errorMessage = "No user input text to process for response.";
                 console.warn("VoiceSalesAgentFlow: PROCESS_USER_RESPONSE called with no user input text.");
                 currentAiSpeech = await synthesizeSpeech({ textToSpeak: "I didn't quite catch that. Could you please repeat your response?", voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                 if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error: ${currentAiSpeech.errorMessage}`;
                 conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                 nextExpectedAction = "USER_RESPONSE"; 
            } else if (userText.toLowerCase().startsWith("[transcription error") || userText.toLowerCase().startsWith("[audio input unclear") || userText.toLowerCase().startsWith("[ai returned an empty transcript")) {
                console.warn("VoiceSalesAgentFlow: Transcription reported an error: ", userText);
                const transcriptionErrorText = `I'm sorry, I had trouble understanding your last response. The system reported: "${userText.substring(0,100)}...". Could you please try speaking again, or perhaps type your response if that's easier?`;
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: transcriptionErrorText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for transcription issue: ${currentAiSpeech.errorMessage}`;
                conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                nextExpectedAction = "USER_RESPONSE";
            } else {
                 const pitchParts = [
                    generatedPitch.productExplanation,
                    generatedPitch.keyBenefitsAndBundles,
                    generatedPitch.discountOrDealExplanation,
                    generatedPitch.objectionHandlingPreviews, 
                    generatedPitch.finalCallToAction,
                ].filter((part): part is string => typeof part === 'string' && part.trim() !== "" && !part.toLowerCase().includes("kb content insufficient") && !part.toLowerCase().includes("would go here") && !part.toLowerCase().includes("error")  && !part.toLowerCase().includes("ai reported an error") && !part.toLowerCase().includes("pitch generation failed"));

                if (pitchParts.length === 0) {
                    console.warn("VoiceSalesAgentFlow: No valid pitch parts could be extracted from the generated pitch structure. KB might be insufficient or problematic.");
                    const pitchProblemText = `I seem to be having trouble constructing the next part of our discussion due to issues with the pitch content from the Knowledge Base. Apologies for that. What are your current thoughts on ${flowInput.product}? Or is there anything specific you'd like to know?`;
                    currentAiSpeech = await synthesizeSpeech({ textToSpeak: pitchProblemText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                    if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for pitch problem: ${currentAiSpeech.errorMessage}`;
                    conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                    nextExpectedAction = "USER_RESPONSE";
                } else {
                    let lastAIPitchContent = "";
                    for (let i = conversationTurns.length - 1; i >= 0; i--) {
                        const turn = conversationTurns[i];
                        if (turn.speaker === 'AI' &&
                            generatedPitch && 
                            turn.text && 
                            generatedPitch.warmIntroduction && !turn.text.includes(generatedPitch.warmIntroduction) &&
                            generatedPitch.personalizedHook && !turn.text.includes(generatedPitch.personalizedHook) &&
                            pitchParts.some(pp => turn.text.includes(pp.substring(0, Math.min(pp.length, 30))))) { // Check if turn text contains a substring of any pitch part
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
                        if (nextAiText === generatedPitch.finalCallToAction || nextPitchPartIndex === pitchParts.length -1) { // If it's the CTA or the last usable part
                            nextExpectedAction = "END_CALL_AND_SCORE"; 
                        } else {
                            nextExpectedAction = "USER_RESPONSE";
                        }
                    } else { 
                        nextAiText = generatedPitch.finalCallToAction || "Is there anything else I can help you with regarding this offer today?";
                        nextExpectedAction = "END_CALL_AND_SCORE"; 
                    }
                    
                    currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextAiText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
                    if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for next pitch part: ${currentAiSpeech.errorMessage}`;
                    conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
                }
            }
        }
      } else if (flowInput.action === "GET_REBUTTAL") {
        if (!flowInput.currentUserInputText) {
          errorMessage = "No user objection text provided to get a rebuttal for.";
          console.warn("VoiceSalesAgentFlow: GET_REBUTTAL called with no user objection text.");
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: "I'm sorry, I didn't catch the objection. Could you please state it again?", voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
          nextExpectedAction = "USER_RESPONSE";
        } else {
          const rebuttalInput: GenerateRebuttalInput = {
            objection: flowInput.currentUserInputText,
            product: flowInput.product,
            knowledgeBaseContext: flowInput.knowledgeBaseContext,
          };
          const rebuttalResult = await generateRebuttal(rebuttalInput);
          rebuttalText = rebuttalResult.rebuttal;
          if(rebuttalText.startsWith("Cannot generate rebuttal:") || rebuttalText.startsWith("Error generating rebuttal:")) {
            errorMessage = (errorMessage ? errorMessage + " | " : "") + `Rebuttal generation failed: ${rebuttalText}`;
            console.warn("VoiceSalesAgentFlow: Rebuttal generation returned an error: ", rebuttalText);
          }
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalText, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
          nextExpectedAction = "USER_RESPONSE"; 
        }
        if (currentAiSpeech) {
            if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for rebuttal: ${currentAiSpeech.errorMessage}`;
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
                metricScores:[{ metric: "Call Length/Interaction", score: 1, feedback: "Call too short or no meaningful user interaction to score." }], 
                summary: "Call too short or insufficient interaction for scoring.", 
                strengths:[], 
                areasForImprovement:[] 
            };
        } else {
            // Use a dummy audio URI because the scoreCall flow expects one, but we use the text transcript.
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
        if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis error for end call: ${currentAiSpeech.errorMessage}`;
        
        if (conversationTurns.length === 0 || conversationTurns[conversationTurns.length - 1].text !== endCallText) {
          conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
        }
        nextExpectedAction = "CALL_SCORED";
      }
    } catch (error: any) {
      console.error("Error in VoiceSalesAgentFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      errorMessage = (errorMessage ? errorMessage + " | " : "") + (error.message || "An unexpected error occurred in the sales agent flow.");
      if (!currentAiSpeech && flowInput.action !== 'END_CALL_AND_SCORE') {
        const errorTextToSpeak = `I'm sorry, a system error occurred: ${error.message.substring(0,100)}. Please try again later.`;
        try {
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: errorTextToSpeak, voiceProfileId: flowInput.voiceProfileId, languageCode: 'en-IN' });
            if (currentAiSpeech.errorMessage) errorMessage = (errorMessage ? errorMessage + " | " : "") + `Speech synthesis for main error: ${currentAiSpeech.errorMessage}`;
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
        } catch (ttsError: any) {
             errorMessage = (errorMessage ? errorMessage + " | " : "") + `Critical TTS error: ${ttsError.message}`;
             // Fallback text turn if TTS itself fails critically
             conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: errorTextToSpeak, timestamp: new Date().toISOString(), audioDataUri: `tts-critical-error:[TTS System Error]: ${errorTextToSpeak.substring(0,50)}...` });
        }
      }
      if (nextExpectedAction !== 'CALL_SCORED') {
         nextExpectedAction = "END_CALL_NO_SCORE"; 
      }
    }

    return {
      conversationTurns,
      currentAiSpeech,
      generatedPitch: (flowInput.action === "START_CONVERSATION" && generatedPitch && !(generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed") || generatedPitch.pitchTitle?.startsWith("Pitch Generation Error"))) ? generatedPitch : flowInput.currentPitchState,
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
    let fallbackSpeech: SimulatedSpeechOutput = { text: errorText, audioDataUri: `tts-input-validation-error:[Invalid Input]: ${errorText.substring(0,50)}...` };
    try {
        fallbackSpeech = await synthesizeSpeech({textToSpeak: errorText, voiceProfileId: input.voiceProfileId, languageCode: 'en-IN'});
    } catch (ttsErr) { console.error("TTS failed for input validation error message", ttsErr); }

    return {
        conversationTurns: input.conversationHistory || [],
        currentAiSpeech: fallbackSpeech,
        errorMessage: `Invalid input: ${errorMessages}` + (fallbackSpeech.errorMessage ? ` | TTS error: ${fallbackSpeech.errorMessage}` : ""),
        nextExpectedAction: input.action === "START_CONVERSATION" ? "END_CALL_NO_SCORE" : input.conversationHistory ? "USER_RESPONSE" : "END_CALL_NO_SCORE",
    };
  }
  
  try {
    return await voiceSalesAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSalesAgentFlow:", error);
    const errorText = `Critical system error in sales agent: ${error.message.substring(0,150)}`;
    let fallbackSpeech: SimulatedSpeechOutput = { text: errorText, audioDataUri: `tts-critical-error:[System Failure]: ${errorText.substring(0,50)}...` };
    try {
        fallbackSpeech = await synthesizeSpeech({textToSpeak: errorText, voiceProfileId: input.voiceProfileId, languageCode: 'en-IN'});
    } catch (ttsErr) { console.error("TTS failed for catastrophic error message", ttsErr); }
    
    let mainErrorMessage = `Critical system error: ${error.message}`;
    if (fallbackSpeech.errorMessage) {
        mainErrorMessage += ` | Speech synthesis for error message failed: ${fallbackSpeech.errorMessage}`;
    }
    return {
      conversationTurns: input.conversationHistory || [],
      currentAiSpeech: fallbackSpeech,
      errorMessage: mainErrorMessage,
      nextExpectedAction: "END_CALL_NO_SCORE",
    };
  }
}
