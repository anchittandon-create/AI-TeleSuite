
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Support Agent conversation.
 * Uses Knowledge Base for answers and simulates speech synthesis.
 * - runVoiceSupportAgentQuery - Handles a user query.
 * - VoiceSupportAgentFlowInput - Input type.
 * - VoiceSupportAgentFlowOutput - Output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Product, /*VoiceSupportAgentFlowInput, VoiceSupportAgentFlowOutput,*/ SimulatedSpeechOutput, PRODUCTS } from '@/types';
import { synthesizeSpeech, SynthesizeSpeechInput } from './speech-synthesis-flow';

const VoiceSupportAgentFlowInputSchema = z.object({
  product: z.enum(PRODUCTS),
  agentName: z.string().optional().describe("Name of the AI agent (for dialogue)."),
  userName: z.string().optional().describe("Name of the user/customer (for dialogue)."),
  countryCode: z.string().optional().describe("Country code for user's number (contextual)."),
  userMobileNumber: z.string().optional().describe("User's mobile number (contextual)."),
  userQuery: z.string().min(3, "User query must be at least 3 characters long."),
  voiceProfileId: z.string().optional().describe("Simulated ID of the cloned voice profile."),
  knowledgeBaseContext: z.string().min(10, "Knowledge base context is required and must be provided."),
});
export type VoiceSupportAgentFlowInput = z.infer<typeof VoiceSupportAgentFlowInputSchema>;

const VoiceSupportAgentFlowOutputSchema = z.object({
    aiResponseText: z.string(),
    aiSpeech: z.object({
        text: z.string(),
        audioDataUri: z.string().optional(),
        voiceProfileId: z.string().optional(),
        errorMessage: z.string().optional(),
    }).optional(),
    escalationSuggested: z.boolean().optional(),
    sourcesUsed: z.array(z.string()).optional(),
    errorMessage: z.string().optional(),
});
export type VoiceSupportAgentFlowOutput = z.infer<typeof VoiceSupportAgentFlowOutputSchema>;


const generateSupportResponsePrompt = ai.definePrompt(
  {
    name: 'generateSupportResponsePrompt',
    input: { schema: z.object({ // Keep prompt input lean
        product: z.enum(PRODUCTS),
        userName: z.string().optional(),
        userQuery: z.string(),
        knowledgeBaseContext: z.string(),
    }) }, 
    output: { schema: z.object({ 
        responseText: z.string().describe("The AI's direct, helpful, and polite answer to the user's query. Start by addressing the user if their name is known (e.g., 'Hello {{userName}}, ...')."), 
        requiresLiveDataFetch: z.boolean().optional().describe("True if the query implies needing live, personal account data not typically in a static KB (e.g., specific expiry dates, invoice details for *this* user)."), 
        sourceMention: z.string().optional().describe("Primary source of information (e.g., 'Knowledge Base', 'General Product Knowledge', 'Simulated Account Check').") 
    }) },
    prompt: `You are a helpful, polite, and highly professional AI Customer Support Agent for {{{product}}}.
Your primary goal is to answer the user's query accurately and concisely, deriving information *strictly and solely* from the provided 'Knowledge Base Context' whenever possible.
{{#if userName}}Address the user as {{{userName}}}.{{/if}}

User's Query: "{{{userQuery}}}"

Knowledge Base Context for {{{product}}} (Primary Source of Truth):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

**Critical Instructions:**

1.  **Prioritize Knowledge Base:**
    *   If the 'Knowledge Base Context' **directly and clearly** answers the user's query:
        *   Use that information verbatim or very closely to formulate your response.
        *   Set 'sourceMention' to 'Knowledge Base'.
        *   Ensure the response is natural and conversational.

2.  **Handling Queries Requiring Live/Personal Data:**
    *   If the query asks for information that is specific to the user's personal account and **NOT typically found in a static Knowledge Base** (e.g., "When is MY plan expiring?", "Where is MY invoice?", "What is MY current data usage?", "Can you reset MY password?"):
        *   You MUST politely state that for such specific account information, you would normally need to access their live account details, which you are simulating or cannot do directly.
        *   Set 'requiresLiveDataFetch' to true.
        *   Set 'sourceMention' to 'Simulated Account Check' or 'Personal Account Data (Simulated)'.
        *   If the Knowledge Base provides *general guidance* on how users can typically find such information (e.g., "Invoices are usually available in your account section on our website under 'Billing History'."), provide this general guidance.
        *   **DO NOT invent or guess any specific user data, dates, personal details, or account numbers.** For instance, do not say "Your plan expires on [made-up date]". Instead say, "I'm unable to access your specific plan expiry date right now. Generally, you can find this information by logging into your account on our website under the 'My Subscriptions' section."

3.  **Handling Queries Not in Knowledge Base (and not personal data):**
    *   If the Knowledge Base does **not** directly answer a general query (and it's not about live personal data):
        *   Politely state that the provided Knowledge Base does not have specific information on that exact query.
        *   Set 'sourceMention' to 'General Product Knowledge'.
        *   Offer general help about {{{product}}} if appropriate, based on the overall context of the KB if possible, or suggest rephrasing the query.
        *   Example: "I don't have specific details on that exact topic in my current knowledge base for {{{product}}}. However, {{{product}}} is generally known for [mention a broad feature from KB if any]. Could you perhaps rephrase your question or ask about a different aspect?"

4.  **Clarity and Conciseness:**
    *   Provide clear, concise, and easy-to-understand answers.
    *   Avoid jargon unless it's defined in the Knowledge Base and relevant.

5.  **Professional Tone:**
    *   Maintain a helpful, empathetic, and professional tone throughout the interaction.

Based *strictly* on the user's query and the provided Knowledge Base Context, generate the 'responseText', determine 'requiresLiveDataFetch', and set 'sourceMention'.
`,
  },
);


const voiceSupportAgentFlow = ai.defineFlow(
  {
    name: 'voiceSupportAgentFlow',
    inputSchema: VoiceSupportAgentFlowInputSchema,
    outputSchema: VoiceSupportAgentFlowOutputSchema,
  },
  async (flowInput): Promise<VoiceSupportAgentFlowOutput> => {
    let aiResponseText = "";
    let aiSpeech: SimulatedSpeechOutput | undefined = undefined;
    let escalationSuggested = false;
    let sourcesUsed: string[] = [];
    let errorMessage: string | undefined = undefined;

    try {
      const promptInput = { // Only pass necessary fields to the prompt
          product: flowInput.product,
          userName: flowInput.userName,
          userQuery: flowInput.userQuery,
          knowledgeBaseContext: flowInput.knowledgeBaseContext,
      };
      const { output: promptResponse } = await generateSupportResponsePrompt(promptInput);

      if (!promptResponse || !promptResponse.responseText) {
        throw new Error("AI failed to generate a support response text.");
      }
      
      aiResponseText = promptResponse.responseText;

      if (promptResponse.sourceMention) {
        sourcesUsed.push(promptResponse.sourceMention);
      }
      if (promptResponse.requiresLiveDataFetch) {
        if (!sourcesUsed.includes("Simulated Account Check") && promptResponse.sourceMention !== "Simulated Account Check" && promptResponse.sourceMention !== "Personal Account Data (Simulated)") {
            sourcesUsed.push("Personal Account Data (Simulated)");
        }
      }
      
      if (aiResponseText.trim() === "" || 
          aiResponseText.toLowerCase().includes("cannot find information") || 
          aiResponseText.toLowerCase().includes("don't have specific details on that exact query") ||
          aiResponseText.toLowerCase().includes("does not have specific information on that exact query") 
        ) {
          if (!aiResponseText.toLowerCase().includes("escalate") && !aiResponseText.toLowerCase().includes("human support agent")) {
            aiResponseText += "\n\nI couldn't find a specific answer for that in my current knowledge. Would you like me to escalate this to a human support agent for further assistance?";
          }
          escalationSuggested = true;
      }


      aiSpeech = await synthesizeSpeech({
        textToSpeak: aiResponseText,
        voiceProfileId: flowInput.voiceProfileId,
      });

      if (aiSpeech.errorMessage && !aiSpeech.audioDataUri?.startsWith("SIMULATED_AUDIO_PLACEHOLDER")) {
        // Log if actual audio generation failed, but not if it's just our placeholder
        console.warn("TTS simulation encountered an error during synthesis:", aiSpeech.errorMessage);
      }

    } catch (error: any) {
      console.error("Error in VoiceSupportAgentFlow:", error);
      errorMessage = error.message || "An unexpected error occurred in the support agent flow.";
      aiResponseText = `I'm sorry, ${flowInput.userName || 'there'}, I encountered an issue trying to process your request. Please try again later.`;
      escalationSuggested = true; 
      try {
        aiSpeech = await synthesizeSpeech({ 
            textToSpeak: aiResponseText, 
            voiceProfileId: flowInput.voiceProfileId 
        });
      } catch (ttsError: any) {
         console.error("Error synthesizing speech for error message:", ttsError);
         // Ensure aiSpeech has some placeholder if synthesis fails completely
         aiSpeech = { text: aiResponseText, audioDataUri: `SIMULATED_AUDIO_PLACEHOLDER:[AI Speech Error]: ${aiResponseText}` };
      }
    }

    return {
      aiResponseText,
      aiSpeech,
      escalationSuggested,
      sourcesUsed: sourcesUsed.length > 0 ? sourcesUsed : undefined,
      errorMessage,
    };
  }
);

export async function runVoiceSupportAgentQuery(input: VoiceSupportAgentFlowInput): Promise<VoiceSupportAgentFlowOutput> {
  const parseResult = VoiceSupportAgentFlowInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("Invalid input for runVoiceSupportAgentQuery:", parseResult.error.format());
    const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    const responseText = `Invalid input: ${errorMessages}`;
    return {
        aiResponseText: responseText,
        aiSpeech: { text: responseText, audioDataUri: `SIMULATED_AUDIO_PLACEHOLDER:[AI Input Error]: ${responseText}` },
        errorMessage: `Invalid input: ${errorMessages}`,
        escalationSuggested: true,
    };
  }

  try {
    return await voiceSupportAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSupportAgentFlow:", error);
    const responseText = "I'm sorry, a critical system error occurred. Please try again later.";
    return {
      aiResponseText: responseText,
      aiSpeech: { text: responseText, audioDataUri: `SIMULATED_AUDIO_PLACEHOLDER:[AI System Error]: ${responseText}` },
      errorMessage: `Critical system error: ${error.message}`,
      escalationSuggested: true,
    };
  }
}
