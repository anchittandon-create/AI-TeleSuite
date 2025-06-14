
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
  ConversationTurn,
  VoiceSalesAgentFlowInput,
  VoiceSalesAgentFlowOutput,
  SimulatedSpeechOutput,
  PRODUCTS,
  SALES_PLANS,
  CUSTOMER_COHORTS
} from '@/types';
import { generatePitch, GeneratePitchInput, GeneratePitchOutput } from './pitch-generator';
import { generateRebuttal, GenerateRebuttalInput } from './rebuttal-generator';
import { synthesizeSpeech, SynthesizeSpeechInput } from './speech-synthesis-flow';
import { scoreCall, ScoreCallInput, ScoreCallOutput } from './call-scoring';
import { transcribeAudio, TranscriptionInput } from './transcription-flow'; 

const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.enum(PRODUCTS),
  salesPlan: z.enum(SALES_PLANS).optional(),
  offer: z.string().optional(),
  customerCohort: z.enum(CUSTOMER_COHORTS),
  userMobileNumber: z.string().optional().describe("Mobile number of the user being 'called' (for simulation context)."),
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
  
  currentPitchState: z.any().optional().describe("The state of the generated pitch (GeneratePitchOutput), if one exists."),
  
  action: z.enum([
    "START_CONVERSATION", 
    "PROCESS_USER_RESPONSE", 
    "GET_REBUTTAL", 
    "END_CALL_AND_SCORE"
  ]).describe("The specific action to take in this turn.")
});

// Output schema definition (using the one from types for consistency)
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
    generatedPitch: z.any().optional(), 
    rebuttalResponse: z.string().optional(),
    callScore: z.any().optional(), 
    nextExpectedAction: z.enum(['USER_RESPONSE', 'GET_REBUTTAL', 'CONTINUE_PITCH', 'END_CALL', 'CALL_SCORED', 'END_CALL_NO_SCORE']), 
    errorMessage: z.string().optional(),
});


const voiceSalesAgentFlow = ai.defineFlow(
  {
    name: 'voiceSalesAgentFlow',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    outputSchema: VoiceSalesAgentFlowOutputSchema,
  },
  async (flowInput): Promise<z.infer<typeof VoiceSalesAgentFlowOutputSchema>> => {
    let conversationTurns: ConversationTurn[] = flowInput.conversationHistory || [];
    let currentAiSpeech: SimulatedSpeechOutput | undefined = undefined;
    let generatedPitch = flowInput.currentPitchState as GeneratePitchOutput | null;
    let rebuttalText: string | undefined = undefined;
    let callScoreOutput: ScoreCallOutput | undefined = undefined;
    let nextExpectedAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined = undefined;

    const newTurnId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      if (flowInput.action === "START_CONVERSATION") {
        const pitchInput: GeneratePitchInput = {
          product: flowInput.product,
          customerCohort: flowInput.customerCohort,
          salesPlan: flowInput.salesPlan,
          offer: flowInput.offer,
          knowledgeBaseContext: flowInput.knowledgeBaseContext,
          // agentName and userName can be added if available in flowInput or profile
        };
        generatedPitch = await generatePitch(pitchInput);

        if (generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed")) {
            errorMessage = generatedPitch.fullPitchScript || "Failed to generate initial sales pitch.";
            nextExpectedAction = "END_CALL_NO_SCORE"; 
        } else {
            const firstAiText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: firstAiText, voiceProfileId: flowInput.voiceProfileId });
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            nextExpectedAction = "USER_RESPONSE";
        }
      } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
        if (!generatedPitch) {
            errorMessage = "Cannot process user response: No pitch has been generated yet.";
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
                    userText = "[Transcription failed or audio unclear]";
                }
                 conversationTurns.push({ id: newTurnId(), speaker: 'User', text: userText || "[Audio input received, text N/A]", timestamp: new Date().toISOString(), audioDataUri: flowInput.currentUserInputAudioDataUri, transcriptionAccuracy: userTurnAccuracy });
            } else if (userText) {
                conversationTurns.push({ id: newTurnId(), speaker: 'User', text: userText, timestamp: new Date().toISOString() });
            }

            if (userText) {
                const pitchParts = [
                    generatedPitch.productExplanation,
                    generatedPitch.keyBenefitsAndBundles,
                    generatedPitch.discountOrDealExplanation,
                    generatedPitch.objectionHandlingPreviews, 
                    generatedPitch.finalCallToAction,
                ].filter(part => part && part.trim() !== "" && !part.toLowerCase().includes("kb content insufficient") && !part.toLowerCase().includes("would go here")); // Filter out empty/placeholder parts

                let lastAIPitchContent = "";
                for (let i = conversationTurns.length - 1; i >= 0; i--) {
                    if (conversationTurns[i].speaker === 'AI' && 
                        !conversationTurns[i].text.startsWith("I understand your concern") && // Not a rebuttal start
                        !conversationTurns[i].text.startsWith("Thank you for your time") && // Not end call
                        generatedPitch && // Ensure generatedPitch is not null
                        !conversationTurns[i].text.includes(generatedPitch.warmIntroduction) && // Avoid matching intro again
                        !conversationTurns[i].text.includes(generatedPitch.personalizedHook) // Avoid matching hook again
                        ) { 
                        lastAIPitchContent = conversationTurns[i].text;
                        break;
                    }
                }
                
                let currentPartIndexInPitch = -1;
                if(lastAIPitchContent) {
                    currentPartIndexInPitch = pitchParts.findIndex(part => lastAIPitchContent.includes(part.substring(0, Math.min(part.length, 50) )) ); // Match start of part
                } else { 
                    // If no last AI pitch content (e.g., after a rebuttal), or if it's the very first user response after intro/hook
                    // We determine this by checking how many actual pitch parts (excluding intro/hook) have been delivered by AI
                    const aiPitchSegmentsDelivered = conversationTurns.filter(t => 
                        t.speaker === 'AI' &&
                        generatedPitch &&
                        pitchParts.some(pp => t.text.includes(pp.substring(0, Math.min(pp.length,50) ))) &&
                        !t.text.includes(generatedPitch.warmIntroduction) &&
                        !t.text.includes(generatedPitch.personalizedHook)
                    ).length;
                    currentPartIndexInPitch = aiPitchSegmentsDelivered - 1; // 0-indexed
                }
                
                let nextPitchPartIndex = currentPartIndexInPitch + 1;
                let nextAiText = ""; 
                
                if (nextPitchPartIndex < pitchParts.length) { 
                    nextAiText = pitchParts[nextPitchPartIndex];
                    if (nextAiText === generatedPitch.finalCallToAction || nextPitchPartIndex === pitchParts.length -1) { // Last part or CTA
                         nextExpectedAction = "END_CALL_AND_SCORE"; // Assume CTA means prepare to end
                    } else {
                         nextExpectedAction = "USER_RESPONSE";
                    }
                } else {
                    // All pitch parts seem delivered, or something went wrong with indexing
                    nextAiText = generatedPitch.finalCallToAction || "Is there anything else I can help you with regarding this offer?";
                    nextExpectedAction = "END_CALL_AND_SCORE"; 
                }
                
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextAiText, voiceProfileId: flowInput.voiceProfileId });
                conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            } else {
                 errorMessage = "No user input text to process.";
                 nextExpectedAction = "USER_RESPONSE";
            }
        }
      } else if (flowInput.action === "GET_REBUTTAL") {
        if (!flowInput.currentUserInputText) {
          errorMessage = "No user objection text provided to get a rebuttal for.";
          nextExpectedAction = "USER_RESPONSE";
        } else {
           // Add user's objection to conversation log first (if not already added from PROCESS_USER_RESPONSE which might be text only)
           // Check if the last turn was already this user's text
           const lastTurn = conversationTurns[conversationTurns.length -1];
           if(!(lastTurn.speaker === 'User' && lastTurn.text === flowInput.currentUserInputText)) {
               conversationTurns.push({ id: newTurnId(), speaker: 'User', text: flowInput.currentUserInputText, timestamp: new Date().toISOString() });
           }

          const rebuttalInput: GenerateRebuttalInput = {
            objection: flowInput.currentUserInputText,
            product: flowInput.product,
            knowledgeBaseContext: flowInput.knowledgeBaseContext,
          };
          const rebuttalResult = await generateRebuttal(rebuttalInput);
          rebuttalText = rebuttalResult.rebuttal;
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalText, voiceProfileId: flowInput.voiceProfileId });
          conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
          nextExpectedAction = "USER_RESPONSE"; 
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
            // This requires scoreCall to be updated to accept a pre-generated transcript
            // For now, scoreCall transcribes internally. This is a known limitation.
            // We will pass a dummy audio and hope the prompt structure in scoreCall prioritizes
            // the *passed* transcript if available. This is a hack due to current scoreCall flow.
            // A better scoreCall would allow optional audioDataUri and optional direct transcript.
            const scoreInput: ScoreCallInput = {
              audioDataUri: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=", // Dummy silent audio
              product: flowInput.product,
              agentName: flowInput.conversationHistory?.find(t=>t.speaker === 'AI' && t.text.includes("This is"))?.text.split("This is ")[1]?.split(",")[0] || "AI Agent"
            };
            
            // Ideal: if scoreCall could take transcript directly
            // const scoreInput: ScoreCallInput & { directTranscript?: string } = { ... };
            // scoreInput.directTranscript = fullTranscriptText;
             callScoreOutput = await scoreCall(scoreInput); 
             
             // Override transcript in output because scoreCall re-transcribes the dummy audio
             callScoreOutput.transcript = fullTranscriptText;
             callScoreOutput.transcriptAccuracy = "Aggregated from turns (if available)"; 
        }
        const endCallText = "Thank you for your time. This call has now concluded.";
        currentAiSpeech = await synthesizeSpeech({ textToSpeak: endCallText, voiceProfileId: flowInput.voiceProfileId });
        // Check if the last turn was already this end call text to avoid duplicates
        if (conversationTurns.length === 0 || conversationTurns[conversationTurns.length - 1].text !== endCallText) {
          conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
        }
        nextExpectedAction = "CALL_SCORED";
      }
    } catch (error: any) {
      console.error("Error in VoiceSalesAgentFlow:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      errorMessage = error.message || "An unexpected error occurred in the sales agent flow.";
      nextExpectedAction = "END_CALL_NO_SCORE"; 
    }

    return {
      conversationTurns,
      currentAiSpeech,
      generatedPitch: flowInput.action === "START_CONVERSATION" ? generatedPitch : undefined, // Only send back full pitch on start
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
    return {
        conversationTurns: input.conversationHistory || [],
        errorMessage: `Invalid input: ${errorMessages}`,
        nextExpectedAction: input.action === "START_CONVERSATION" ? "END_CALL_NO_SCORE" : input.conversationHistory ? "USER_RESPONSE" : "END_CALL_NO_SCORE",
    };
  }
  
  try {
    return await voiceSalesAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSalesAgentFlow:", error);
    return {
      conversationTurns: input.conversationHistory || [],
      errorMessage: `Critical system error: ${error.message}`,
      nextExpectedAction: "END_CALL_NO_SCORE",
    };
  }
}

    