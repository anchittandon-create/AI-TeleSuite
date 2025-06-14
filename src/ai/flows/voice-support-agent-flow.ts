
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
import { Product, VoiceSupportAgentFlowInput, VoiceSupportAgentFlowOutput, SimulatedSpeechOutput, PRODUCTS } from '@/types';
import { synthesizeSpeech, SynthesizeSpeechInput } from './speech-synthesis-flow';

const VoiceSupportAgentFlowInputSchema = z.object({
  product: z.enum(PRODUCTS),
  userQuery: z.string().min(3, "User query must be at least 3 characters long."),
  voiceProfileId: z.string().optional().describe("Simulated ID of the cloned voice profile."),
  knowledgeBaseContext: z.string().min(10, "Knowledge base context is required and must be provided."),
  // languageCode: z.string().default('en-IN'), // Potentially add if TTS needs it explicitly here too
});

// Using VoiceSupportAgentFlowOutput from types for consistency with Zod schema there
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

const generateSupportResponsePrompt = ai.definePrompt(
  {
    name: 'generateSupportResponsePrompt',
    // Use a more specific input schema for the prompt itself, containing only what it needs
    input: { schema: z.object({
        product: z.enum(PRODUCTS),
        userQuery: z.string(),
        knowledgeBaseContext: z.string(),
    }) }, 
    output: { schema: z.object({ 
        responseText: z.string().describe("The AI's direct answer to the user's query."), 
        requiresLiveDataFetch: z.boolean().optional().describe("True if the query implies needing live, personal account data not typically in a static KB."), 
        sourceMention: z.string().optional().describe("Primary source of information (e.g., 'Knowledge Base', 'General Product Knowledge', 'Simulated Account Check').") 
    }) },
    prompt: `You are a helpful and polite AI Customer Support Agent for {{{product}}}.
Your primary goal is to answer the user's query accurately and concisely based *solely* on the provided 'Knowledge Base Context'.
If the query requires information not present in the 'KnowledgeBase Context' (e.g., specific, live user account details like "When is MY plan expiring?", "Where is MY invoice?", "What is MY current data usage?"), you MUST:
1.  Politely state that for such specific account information, you would normally access their live account details.
2.  Set 'requiresLiveDataFetch' to true in your response.
3.  Provide general guidance based on the Knowledge Base if possible (e.g., "Typically, invoices can be found in your account section on our website under 'Billing History'.").
4.  Mention 'Simulated Account Check' as the 'sourceMention' if you are simulating this.
5.  Do NOT invent or guess any specific user data, dates, or personal details.

If the Knowledge Base *directly and clearly* answers the query:
1.  Use that information verbatim or very closely.
2.  Set 'sourceMention' to 'Knowledge Base'.

If the Knowledge Base does *not* directly answer the query, and it's *not* about live personal data:
1.  Politely state that the provided Knowledge Base does not have specific information on that exact query.
2.  Set 'sourceMention' to 'General Product Knowledge'.
3.  Offer general help about {{{product}}} if appropriate, or suggest rephrasing the query.

User's Query: "{{{userQuery}}}"

Knowledge Base Context for {{{product}}} (Primary Source of Truth):
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Based strictly on the user's query and the Knowledge Base:
1.  Formulate a concise, helpful, and professional textual response for 'responseText'.
2.  Determine if 'requiresLiveDataFetch' is true.
3.  Set 'sourceMention' appropriately.

Respond clearly and directly to the user's query.
`,
  },
);


const voiceSupportAgentFlow = ai.defineFlow(
  {
    name: 'voiceSupportAgentFlow',
    inputSchema: VoiceSupportAgentFlowInputSchema,
    outputSchema: VoiceSupportAgentFlowOutputSchema,
  },
  async (flowInput): Promise<z.infer<typeof VoiceSupportAgentFlowOutputSchema>> => {
    let aiResponseText = "";
    let aiSpeech: SimulatedSpeechOutput | undefined = undefined;
    let escalationSuggested = false;
    let sourcesUsed: string[] = [];
    let errorMessage: string | undefined = undefined;

    try {
      const promptInput = {
          product: flowInput.product,
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
        // The prompt should ideally handle the phrasing for simulated live data access.
        // If not, we can add a generic note here.
        // aiResponseText += " (Note: For specific account details, I would typically access your live account data. This part of the process is simulated.)";
        if (!sourcesUsed.includes("Simulated Account Check") && promptResponse.sourceMention !== "Simulated Account Check") {
            sourcesUsed.push("Simulated Account Check");
        }
      }
      
      if (aiResponseText.trim() === "" || aiResponseText.toLowerCase().includes("cannot find information") || aiResponseText.toLowerCase().includes("don't have specific details")) {
          // If AI indicates it can't help or KB is empty for the query, suggest escalation
          if (!aiResponseText.toLowerCase().includes("escalate") && !aiResponseText.toLowerCase().includes("human agent")) {
            aiResponseText += "\n\nI couldn't find a specific answer in the knowledge base. Would you like me to escalate this to a human support agent for further assistance?";
          }
          escalationSuggested = true;
      }


      // Synthesize speech for the AI's response
      aiSpeech = await synthesizeSpeech({
        textToSpeak: aiResponseText,
        voiceProfileId: flowInput.voiceProfileId,
        // languageCode: flowInput.languageCode,
      });

      if (aiSpeech.errorMessage) {
        console.warn("TTS simulation encountered an error:", aiSpeech.errorMessage);
        // Decide if this error should be propagated to the main errorMessage for the flow
      }


    } catch (error: any) {
      console.error("Error in VoiceSupportAgentFlow:", error);
      errorMessage = error.message || "An unexpected error occurred in the support agent flow.";
      aiResponseText = "I'm sorry, I encountered an issue trying to process your request. Please try again later.";
      escalationSuggested = true; // Suggest escalation on error
      // Attempt to synthesize the error message itself
      try {
        aiSpeech = await synthesizeSpeech({ 
            textToSpeak: aiResponseText, 
            voiceProfileId: flowInput.voiceProfileId 
        });
      } catch (ttsError: any) {
         console.error("Error synthesizing speech for error message:", ttsError);
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
    return {
        aiResponseText: `Invalid input: ${errorMessages}`,
        errorMessage: `Invalid input: ${errorMessages}`,
        escalationSuggested: true,
    };
  }

  try {
    return await voiceSupportAgentFlow(parseResult.data);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling voiceSupportAgentFlow:", error);
    return {
      aiResponseText: "I'm sorry, a critical system error occurred. Please try again later.",
      errorMessage: `Critical system error: ${error.message}`,
      escalationSuggested: true,
    };
  }
}

    