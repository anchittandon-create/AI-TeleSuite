
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
import { z } from 'genkit';
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
import { generatePitch, GeneratePitchInput } from './pitch-generator';
import { generateRebuttal, GenerateRebuttalInput } from './rebuttal-generator';
import { synthesizeSpeech, SynthesizeSpeechInput } from './speech-synthesis-flow';
import { scoreCall, ScoreCallInput } from './call-scoring';
import { transcribeAudio, TranscriptionInput } from './transcription-flow'; // Assuming user audio snippets can be transcribed

const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.enum(PRODUCTS),
  salesPlan: z.enum(SALES_PLANS).optional(),
  offer: z.string().optional(),
  customerCohort: z.enum(CUSTOMER_COHORTS),
  voiceProfileId: z.string().optional().describe("Simulated ID of the cloned voice profile."),
  knowledgeBaseContext: z.string().describe("Context from Knowledge Base for pitch and rebuttals."),
  
  // Conversation state (passed on subsequent turns)
  conversationHistory: z.array(z.object({ // Simplified ConversationTurn for schema
    id: z.string(),
    speaker: z.enum(['AI', 'User']),
    text: z.string(),
    timestamp: z.string(),
    audioDataUri: z.string().optional(),
  })).optional().describe("History of the conversation turns."),
  
  currentUserInputText: z.string().optional().describe("Text of the user's latest response (already transcribed)."),
  currentUserInputAudioDataUri: z.string().optional().describe("Data URI of the user's latest recorded response (if applicable)."),
  
  currentPitchState: z.any().optional().describe("The state of the generated pitch, if one exists."), // Opaque for now
  
  action: z.enum([
    "START_CONVERSATION", 
    "PROCESS_USER_RESPONSE", 
    "GET_REBUTTAL", // User flags an objection
    "END_CALL_AND_SCORE"
  ]).describe("The specific action to take in this turn.")
});

// Output schema definition (using the one from types for consistency)
const VoiceSalesAgentFlowOutputSchema = z.object({
    conversationTurns: z.array(z.object({ // Simplified ConversationTurn for schema
        id: z.string(),
        speaker: z.enum(['AI', 'User']),
        text: z.string(),
        timestamp: z.string(),
        audioDataUri: z.string().optional(),
    })),
    currentAiSpeech: z.object({
        text: z.string(),
        audioDataUri: z.string().optional(),
        voiceProfileId: z.string().optional(),
        errorMessage: z.string().optional(),
    }).optional(),
    generatedPitch: z.any().optional(), // Actual pitch output type
    rebuttalResponse: z.string().optional(),
    callScore: z.any().optional(), // Actual score output type
    nextExpectedAction: z.string(), // e.g., 'USER_RESPONSE', 'END_CALL'
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
    let generatedPitch = flowInput.currentPitchState as any; // Cast to any for easier handling
    let rebuttalText: string | undefined = undefined;
    let callScoreOutput: any | undefined = undefined; // Actual ScoreCallOutput
    let nextExpectedAction: VoiceSalesAgentFlowOutput['nextExpectedAction'] = 'USER_RESPONSE';
    let errorMessage: string | undefined = undefined;

    const newTurnId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      if (flowInput.action === "START_CONVERSATION") {
        // 1. Generate Pitch
        const pitchInput: GeneratePitchInput = {
          product: flowInput.product,
          customerCohort: flowInput.customerCohort,
          salesPlan: flowInput.salesPlan,
          offer: flowInput.offer,
          knowledgeBaseContext: flowInput.knowledgeBaseContext,
          // agentName, userName could be passed if available
        };
        generatedPitch = await generatePitch(pitchInput);

        if (generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed")) {
            errorMessage = generatedPitch.fullPitchScript || "Failed to generate initial sales pitch.";
            nextExpectedAction = "END_CALL"; // Cannot proceed
        } else {
            const firstAiText = `${generatedPitch.warmIntroduction} ${generatedPitch.personalizedHook}`;
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: firstAiText, voiceProfileId: flowInput.voiceProfileId });
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            nextExpectedAction = "USER_RESPONSE";
        }
      } else if (flowInput.action === "PROCESS_USER_RESPONSE") {
        if (!generatedPitch) {
            errorMessage = "Cannot process user response: No pitch has been generated yet.";
            nextExpectedAction = "END_CALL";
        } else {
            let userText = flowInput.currentUserInputText;
            if (flowInput.currentUserInputAudioDataUri && !userText) {
                // Transcribe user audio if provided and no text version exists
                const transcriptionResult = await transcribeAudio({ audioDataUri: flowInput.currentUserInputAudioDataUri });
                if (transcriptionResult.diarizedTranscript && !transcriptionResult.diarizedTranscript.startsWith("[")) { // Basic error check
                    userText = transcriptionResult.diarizedTranscript; // Simplified: assuming single speaker or take relevant part
                } else {
                    userText = "[Transcription failed or audio unclear]";
                }
                 conversationTurns.push({ id: newTurnId(), speaker: 'User', text: userText || "[Audio input received, text N/A]", timestamp: new Date().toISOString(), audioDataUri: flowInput.currentUserInputAudioDataUri, transcriptionAccuracy: transcriptionResult.accuracyAssessment });
            } else if (userText) {
                conversationTurns.push({ id: newTurnId(), speaker: 'User', text: userText, timestamp: new Date().toISOString() });
            }


            if (userText) {
                // Simple logic: Respond with next part of pitch.
                // More complex logic would analyze userText for intent, questions, objections.
                // For now, we assume the user might raise an objection, which they'd flag via GET_REBUTTAL.
                // So, the AI just continues the pitch.
                // This needs a state machine for the pitch sequence.
                const pitchParts = [
                    generatedPitch.productExplanation,
                    generatedPitch.keyBenefitsAndBundles,
                    generatedPitch.discountOrDealExplanation,
                    generatedPitch.objectionHandlingPreviews, // This is a preview, actual handling via GET_REBUTTAL
                    generatedPitch.finalCallToAction,
                ];
                // Find current part based on conversationTurns
                const aiTurns = conversationTurns.filter(t => t.speaker === 'AI').length;
                let nextPitchPart = "It seems we've covered the main points. What are your thoughts?"; // Default if pitch is "done"
                
                if (aiTurns -1 < pitchParts.length) { // -1 because first AI turn was intro+hook
                    nextPitchPart = pitchParts[aiTurns-1];
                }
                
                if (nextPitchPart === generatedPitch.finalCallToAction) {
                    nextExpectedAction = "END_CALL_AND_SCORE"; // Or wait for user confirmation
                } else {
                    nextExpectedAction = "USER_RESPONSE";
                }
                
                currentAiSpeech = await synthesizeSpeech({ textToSpeak: nextPitchPart, voiceProfileId: flowInput.voiceProfileId });
                conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
            } else {
                 errorMessage = "No user input text to process.";
                 nextExpectedAction = "USER_RESPONSE"; // Prompt user again
            }
        }
      } else if (flowInput.action === "GET_REBUTTAL") {
        if (!flowInput.currentUserInputText) {
          errorMessage = "No user objection text provided to get a rebuttal for.";
          nextExpectedAction = "USER_RESPONSE";
        } else {
          const rebuttalInput: GenerateRebuttalInput = {
            objection: flowInput.currentUserInputText,
            product: flowInput.product,
            knowledgeBaseContext: flowInput.knowledgeBaseContext,
          };
          const rebuttalResult = await generateRebuttal(rebuttalInput);
          rebuttalText = rebuttalResult.rebuttal;
          currentAiSpeech = await synthesizeSpeech({ textToSpeak: rebuttalText, voiceProfileId: flowInput.voiceProfileId });
          conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
          nextExpectedAction = "USER_RESPONSE"; // After rebuttal, wait for user.
        }
      } else if (flowInput.action === "END_CALL_AND_SCORE") {
        // Collate full transcript
        const fullTranscriptText = conversationTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n');
        
        if (fullTranscriptText.length < 20) { // Arbitrary minimum length for a meaningful call
            callScoreOutput = { summary: "Call too short or no meaningful interaction to score.", overallScore: 0, callCategorisation: "Error", transcript: fullTranscriptText, transcriptAccuracy: "N/A", metricScores:[] };
        } else {
            const scoreInput: ScoreCallInput = {
              // Need to simulate an audioDataUri for the entire call for scoreCall if it expects one.
              // For now, scoreCall's prompt uses the transcript. This part might need refinement if scoreCall strictly needs audio.
              // Let's assume scoreCall can work with just a transcript if its internal transcription step is bypassed/adapted.
              // The current scoreCall flow *does* take audioDataUri and transcribes it first.
              // This is a GAP: We don't have a combined audio of the AI + User.
              // HACK: We will pass a dummy audio URI and rely on the `transcript` field logic if scoreCall is adapted for it,
              // OR, scoreCall will fail transcription. For now, we pass the text transcript to log.
              // Ideally, ScoreCallInput would accept transcript directly.
              audioDataUri: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=", // Dummy silent WAV
              product: flowInput.product,
              // agentName: from user profile or form
            };
             // The current scoreCall flow expects audio and transcribes.
             // We need to modify scoreCall or this flow to pass the transcript directly.
             // For this prototype, we will mock the scoring based on the transcript.
             // This is a significant simplification.
            callScoreOutput = {
                transcript: fullTranscriptText,
                transcriptAccuracy: "Aggregated from turns", // Placeholder
                overallScore: Math.random() * 2 + 3, // Random score between 3-5
                callCategorisation: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)] === "ET" ? "Good" : "Average",
                metricScores: [{metric: "Overall Impression (Simulated)", score: 4, feedback: "This is a simulated score based on the text transcript."}],
                summary: "This call has been scored (simulated) based on the conversation log.",
                strengths: ["Simulated strength: Good engagement"],
                areasForImprovement: ["Simulated improvement: Could explore needs further"]
            };
            // Simulate AI speech for end of call
            const endCallText = "Thank you for your time. This call has now ended and will be summarized.";
            currentAiSpeech = await synthesizeSpeech({ textToSpeak: endCallText, voiceProfileId: flowInput.voiceProfileId });
            conversationTurns.push({ id: newTurnId(), speaker: 'AI', text: currentAiSpeech.text, timestamp: new Date().toISOString(), audioDataUri: currentAiSpeech.audioDataUri });
        }
        nextExpectedAction = "CALL_SCORED";
      }
    } catch (error: any) {
      console.error("Error in VoiceSalesAgentFlow:", error);
      errorMessage = error.message || "An unexpected error occurred in the sales agent flow.";
      nextExpectedAction = "END_CALL"; // Or a specific error state
    }

    return {
      conversationTurns,
      currentAiSpeech,
      generatedPitch: flowInput.action === "START_CONVERSATION" ? generatedPitch : undefined, // Only return new pitch on start
      rebuttalResponse: rebuttalText,
      callScore: callScoreOutput,
      nextExpectedAction,
      errorMessage,
    };
  }
);

export async function runVoiceSalesAgentTurn(input: VoiceSalesAgentFlowInput): Promise<VoiceSalesAgentFlowOutput> {
  // Input validation can be done here with the Zod schema if needed before calling the flow
  const parseResult = VoiceSalesAgentFlowInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for runVoiceSalesAgentTurn:", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
        conversationTurns: input.conversationHistory || [],
        errorMessage: `Invalid input: ${errorMessages}`,
        nextExpectedAction: input.action === "START_CONVERSATION" ? "END_CALL" : input.conversationHistory ? "USER_RESPONSE" : "END_CALL",
    };
  }
  
  try {
    // @ts-ignore
    return await voiceSalesAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSalesAgentFlow:", error);
    return {
      conversationTurns: input.conversationHistory || [],
      errorMessage: `Critical system error: ${error.message}`,
      nextExpectedAction: "END_CALL",
    };
  }
}
