
'use server';
/**
 * @fileOverview Orchestrates an AI Voice Support Agent conversation.
 * Uses Knowledge Base for answers and simulates speech synthesis.
 * - runVoiceSupportAgentQuery - Handles a user query.
 * - VoiceSupportAgentFlowInput - Input type.
 * - VoiceSupportAgentFlowOutput - Output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
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
    input: { schema: VoiceSupportAgentFlowInputSchema }, // Uses the same input as the flow for simplicity here
    output: { schema: z.object({ responseText: z.string(), requiresLiveDataFetch: z.boolean().optional(), mentionsSource: z.string().optional() }) },
    prompt: `You are a helpful AI Customer Support Agent for {{{product}}}.
Your goal is to answer the user's query based *primarily* on the provided Knowledge Base Context.
If the query seems to require live account data (e.g., "When is MY plan expiring?", "Where is MY invoice?", "What is MY current data usage?"),
you should state that you would typically fetch this live data, but for now, you can provide general information or guide them where they *might* find it.
Do NOT invent specific user data.

User's Query: "{{{userQuery}}}"

Knowledge Base Context for {{{product}}}:
\`\`\`
{{{knowledgeBaseContext}}}
\`\`\`

Based on the user's query and the Knowledge Base:
1.  Formulate a concise and helpful textual response.
2.  If the KB directly answers the query, use that information. Indicate 'mentionsSource' as 'Knowledge Base'.
3.  If the query implies needing specific, personal account data NOT in the KB (like "MY invoice", "MY expiry date"):
    - Politely state that you'd normally check their account details.
    - Set 'requiresLiveDataFetch' to true.
    - Provide general guidance based on the KB if possible (e.g., "Typically, invoices can be found in your account section on our website under 'Billing History'.").
    - Indicate 'mentionsSource' as 'Simulated Account System' or 'Knowledge Base for general info'.
4.  If the KB doesn't cover the query and it's not about live data, offer to escalate or provide general help.

Respond clearly and politely.
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
      const { output: promptResponse } = await generateSupportResponsePrompt(flowInput);

      if (!promptResponse || !promptResponse.responseText) {
        throw new Error("AI failed to generate a support response.");
      }
      
      aiResponseText = promptResponse.responseText;
      if (promptResponse.mentionsSource) {
        sourcesUsed.push(promptResponse.mentionsSource);
      }
      if (promptResponse.requiresLiveDataFetch) {
        // Add a note about live data simulation if needed, or the prompt already handles it.
        aiResponseText += " (Note: Live data access is simulated in this prototype.)";
        sourcesUsed.push("Simulated Live Data System");
      }

      // Synthesize speech for the AI's response
      aiSpeech = await synthesizeSpeech({
        textToSpeak: aiResponseText,
        voiceProfileId: flowInput.voiceProfileId,
        // languageCode: flowInput.languageCode,
      });

      // Simple escalation logic (can be expanded)
      if (aiResponseText.toLowerCase().includes("cannot help") || aiResponseText.toLowerCase().includes("don't know")) {
        escalationSuggested = true;
        aiResponseText += "\nWould you like me to connect you to a human agent for further assistance?";
        // Re-synthesize if adding escalation text
         aiSpeech = await synthesizeSpeech({
            textToSpeak: aiResponseText,
            voiceProfileId: flowInput.voiceProfileId,
        });
      }

    } catch (error: any) {
      console.error("Error in VoiceSupportAgentFlow:", error);
      errorMessage = error.message || "An unexpected error occurred in the support agent flow.";
      aiResponseText = "I'm sorry, I encountered an issue trying to process your request. Please try again later.";
      // Attempt to synthesize the error message itself
      try {
        aiSpeech = await synthesizeSpeech({ textToSpeak: aiResponseText, voiceProfileId: flowInput.voiceProfileId });
      } catch (ttsError: any) {
        // If TTS for error also fails, speech will be undefined
         console.error("Error synthesizing speech for error message:", ttsError);
      }
      escalationSuggested = true; // Suggest escalation on error
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
    // @ts-ignore Genkit flow type inference with Zod can be tricky for direct calls
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
