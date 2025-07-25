
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


const conversationRouterPrompt = ai.definePrompt({
    name: 'conversationRouterPrompt',
    model: 'googleai/gemini-2.0-flash', // FIX: Explicitly define the model to use
    input: { schema: z.object({
        conversationHistory: z.string(),
        pitchState: z.custom<FullGeneratePitchOutput>(),
        knowledgeBaseContext: z.string(),
        userName: z.string().optional(),
        product: z.string(),
    })},
    output: { schema: z.object({
        nextAction: z.enum(['ANSWER_QUESTION', 'CONTINUE_PITCH', 'HANDLE_OBJECTION', 'END_CALL']),
        responseText: z.string().describe("The full, detailed text for the AI to speak next. If answering a question, provide a comprehensive answer using the KB. If continuing the pitch, provide the next logical pitch section. If handling an objection, provide an empathetic acknowledgment before the full rebuttal is generated."),
        confidenceScore: z.number().min(0).max(1).describe("Your confidence in this decision (0-1)."),
    })},
    prompt: `You are the core logic engine for an AI Voice Sales Agent. Your job is to decide the next step in a sales conversation based on the user's most recent input.

**Context:**
- **Product:** {{product}}
- **Customer:** {{userName}}
- **Knowledge Base:** I have access to a knowledge base with product details, benefits, pricing, etc.
- **Sales Pitch Structure:** I have a pre-generated, structured sales pitch with the following sections:
  1. Introduction & Hook
  2. Product Explanation
  3. Key Benefits & Bundles
  4. Discount/Deal Explanation
  5. Objection Handling Previews
  6. Final Call to Action

**Conversation History:**
{{conversationHistory}}

**Your Task:**
Analyze the user's last response and decide what to do next. Choose ONE of the following actions:

1.  **ANSWER_QUESTION**: Choose this if the user asks a specific question (e.g., "How much does it cost?", "What are the benefits again?", "Tell me more about the ad-free experience.").
    - **Response Text:** Generate a **full, detailed, and comprehensive answer** using the provided 'Knowledge Base Context'. Do not be brief. If they ask for benefits, explain all the key benefits from the KB. If they ask for price, explain the pricing from the KB.

2.  **HANDLE_OBJECTION**: Choose this if the user expresses a clear objection (e.g., "It's too expensive," "I don't have time," "I'm not interested," "Let me think about it").
    - **Response Text:** Provide a brief, empathetic acknowledgment of their concern (e.g., "I understand that price is an important consideration," or "That's a fair point, time is valuable."). The main rebuttal will be generated by another tool.

3.  **CONTINUE_PITCH**: Choose this if the user's response is neutral, positive, or a simple acknowledgment (e.g., "Okay," "Uh-huh," "Go on," "Sounds interesting.").
    - **Response Text:** Select the **next logical, un-discussed section** from the pre-generated pitch. For example, if you just explained the product, the next part would be "Key Benefits & Bundles".

4.  **END_CALL**: Choose this if the user clearly wants to end the conversation (e.g., "I have to go," "Please don't call again," "Goodbye") or if the pitch has naturally concluded with the call to action.
    - **Response Text:** Provide a polite closing remark (e.g., "Alright, thank you for your time, {{userName}}. Have a great day.").

**Output Instructions:**
- **responseText:** Provide the complete text the AI should speak. Be thorough and helpful.
- **nextAction:** Choose only one action from the list above.
- **confidenceScore:** How confident are you in your decision?

Now, analyze the conversation and provide your response.`,
});


const voiceSalesAgentFlow = ai.defineFlow(
  {
    name: 'voiceSalesAgentFlow',
    inputSchema: VoiceSalesAgentFlowInputSchema,
    // Model specified in the router prompt now, not needed here for this logic.
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

        if (generatedPitch.pitchTitle?.startsWith("Pitch Generation Failed")) {
            errorMessage = `Pitch generation failed: ${generatedPitch.warmIntroduction}`;
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
            const conversationHistoryText = [...conversationTurns, { id: 'user-input', speaker: 'User', text: flowInput.currentUserInputText, timestamp: new Date().toISOString() }]
                .map(t => `${t.speaker}: ${t.text}`).join('\n');

            const routerResult = await conversationRouterPrompt({
                conversationHistory: conversationHistoryText,
                pitchState: generatedPitch,
                knowledgeBaseContext: flowInput.knowledgeBaseContext,
                userName: flowInput.userName,
                product: flowInput.product
            });

            if (!routerResult.output) {
                throw new Error("Conversation router failed to return a response.");
            }

            const { nextAction, responseText } = routerResult.output;
            
            await addAiTurn(responseText);

            if (nextAction === 'HANDLE_OBJECTION') {
                nextExpectedAction = 'GET_REBUTTAL';
            } else if (nextAction === 'END_CALL') {
                nextExpectedAction = 'END_CALL';
            } else { // ANSWER_QUESTION or CONTINUE_PITCH
                nextExpectedAction = 'USER_RESPONSE';
            }
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
