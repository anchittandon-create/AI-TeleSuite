
'use server';
/**
 * @fileOverview Speech synthesis flow that uses a self-hosted OpenTTS engine.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import { GOOGLE_PRESET_VOICES } from '@/hooks/use-voice-samples';

const synthesizeSpeechOpenTTSFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechOpenTTSFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    // Map our app's voice IDs to a voice OpenTTS might understand.
    // Defaulting to a common English voice. You would configure this to match your OpenTTS setup.
    const voiceToUse = voiceProfileId || 'en-US-Wavenet-F'; 

    const openTTSServerUrl = 'http://localhost:5500/api/tts';
    
    try {
      console.log(`Calling self-hosted OpenTTS server at: ${openTTSServerUrl}`);
      const response = await fetch(openTTSServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            text: textToSpeak, 
            // The parameter for voice may vary based on the TTS engine. 'voice' is common.
            voice: voiceToUse, 
            ssml: false 
        }),
      });

      if (response.ok) {
        // OpenTTS returns the audio directly. We need to convert it to a data URI.
        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

        return {
          text: textToSpeak,
          audioDataUri: audioDataUri,
          voiceProfileId: voiceToUse,
        };
      } else {
        const errorText = await response.text();
        console.error(`OpenTTS server failed with status ${response.status}: ${errorText}.`);
        throw new Error(`OpenTTS Server Error: ${errorText} (Status: ${response.status}). Please ensure your local OpenTTS server is running at ${openTTSServerUrl}.`);
      }
    } catch (apiRouteError: any) {
      console.error(`❌ Self-hosted OpenTTS server call failed catastrophically:`, apiRouteError);
      
      const detailedErrorMessage = `[OpenTTS Service Error]: Could not generate audio. Please ensure your local OpenTTS server is running and accessible at ${openTTSServerUrl}. Error: ${apiRouteError.message}`;
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:${detailedErrorMessage}`,
        errorMessage: detailedErrorMessage,
        voiceProfileId: voiceToUse,
      };
    }
  }
);


export async function synthesizeSpeechWithOpenTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const parseResult = SynthesizeSpeechInputSchema.safeParse(input);
  if (!parseResult.success) {
      const errorMessage = `Input validation failed for speech synthesis: ${parseResult.error.format()}`;
      console.error("❌ synthesizeSpeechWithOpenTTS wrapper caught Zod error:", errorMessage);
       return {
        text: input.textToSpeak || "Invalid input",
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage,
        voiceProfileId: input.voiceProfileId
      };
  }
  return await synthesizeSpeechOpenTTSFlow(input);
}
