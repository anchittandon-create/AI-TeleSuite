
'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted TTS engine.
 * This flow synthesizes text into audible speech using a selected voice profile
 * and returns a Data URI. It calls a local TTS server endpoint.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(500, "Text to speak cannot exceed 500 characters."),
  voiceProfileId: z.string().optional().describe('The ID of the pre-built voice to use for synthesis (e.g., a voice name supported by the self-hosted TTS).'),
});
export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

const SynthesizeSpeechOutputSchema = z.object({
    text: z.string().describe("The original text that was intended for speech synthesis."),
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio (e.g., 'data:audio/wav;base64,...') or an error message placeholder if synthesis failed."),
    voiceProfileId: z.string().optional().describe("The voice profile ID that was actually used for synthesis."),
    errorMessage: z.string().optional().describe("Any error message if the synthesis had an issue."),
});
export type SynthesizeSpeechOutput = z.infer<typeof SynthesizeSpeechOutputSchema>;


const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutputSchema,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    
    // Default to a standard voice if none is provided. This should match a voice available in your self-hosted TTS.
    const voiceToUse = voiceProfileId || "thorsten-de"; 
    const ttsUrl = `http://localhost:5500/api/tts?voice=${encodeURIComponent(voiceToUse)}&text=${encodeURIComponent(textToSpeak)}`;
    
    console.log(`🎤 Self-Hosted TTS Info: Attempting speech generation. Voice: ${voiceToUse}, URL (text truncated): ${ttsUrl.substring(0, 150)}...`);

    try {
      const response = await fetch(ttsUrl, {
        method: 'GET', // OpenTTS often uses GET for simple requests
        headers: {
            'Content-Type': 'audio/wav',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS server returned an error: ${response.status} ${response.statusText}. Details: ${errorText.substring(0,200)}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      const audioDataUri = `data:audio/wav;base64,${audioBase64}`;
      
      console.log(`✅ Self-Hosted TTS Success: Generated playable WAV audio URI. Length: ${audioDataUri.length}`);

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (error: any) {
        const errorMessage = `Self-Hosted TTS Request FAILED for voice '${voiceToUse}'. Error: ${error.message || 'Unknown error'}. Ensure your local TTS server is running and accessible at http://localhost:5500.`;
        console.error(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
    }
  }
);


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    
    // Additional pre-flow validation
    if (!validatedInput.textToSpeak || validatedInput.textToSpeak.trim() === "") {
        throw new Error("Text to speak cannot be empty.");
    }

    return await synthesizeSpeechFlow(validatedInput);
  } catch (e: any) {
    let errorMessage = `Failed to synthesize speech: ${e.message}`;
    const errorUri = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'})]: ${(input.textToSpeak || "No text provided").substring(0,50)}...`;

    if (e instanceof z.ZodError) {
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join('; ')}`;
    }
    
    console.error("❌ synthesizeSpeech wrapper caught error:", errorMessage);
    
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
