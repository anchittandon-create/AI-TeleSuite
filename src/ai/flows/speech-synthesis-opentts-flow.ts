
'use server';
/**
 * @fileOverview Speech synthesis flow that uses a self-hosted OpenTTS engine.
 * THIS FLOW IS NOW CLIENT-SIDE. The function is exported to be used directly on the page,
 * allowing the browser to call `localhost` directly.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';

const openTTSServerUrl = 'http://localhost:5500/api/tts';

/**
 * This function now runs on the client-side to call the local OpenTTS server.
 */
export async function synthesizeSpeechWithOpenTTS(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const parseResult = SynthesizeSpeechInputSchema.safeParse(input);
  if (!parseResult.success) {
      const errorMessage = `Input validation failed for speech synthesis: ${parseResult.error.format()}`;
      console.error("❌ synthesizeSpeechWithOpenTTS caught Zod error:", errorMessage);
       return {
        text: input.textToSpeak || "Invalid input",
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage,
        voiceProfileId: input.voiceProfileId
      };
  }
    
  const { textToSpeak, voiceProfileId } = input;
  const voiceToUse = voiceProfileId || 'en-us-hfc_female-medium'; 

  try {
    console.log(`Calling self-hosted OpenTTS server from client at: ${openTTSServerUrl}`);
    const response = await fetch(openTTSServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          text: textToSpeak, 
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
    
    let detailedErrorMessage = `[OpenTTS Service Error]: Could not generate audio. Please ensure your local OpenTTS server is running and accessible at ${openTTSServerUrl}. Error: ${apiRouteError.message}`;
    if(apiRouteError.message.includes('fetch failed')) {
        detailedErrorMessage = `Could not connect to the local OpenTTS server. Please ensure the server is running and accessible at ${openTTSServerUrl}. (Details: ${apiRouteError.message})`;
    }
    
    return {
      text: textToSpeak,
      audioDataUri: `tts-flow-error:${detailedErrorMessage}`,
      errorMessage: detailedErrorMessage,
      voiceProfileId: voiceToUse,
    };
  }
}
