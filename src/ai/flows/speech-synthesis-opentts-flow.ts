
'use server';
/**
 * @fileOverview Speech synthesis flow for OpenTTS.
 * This flow is designed to be called from the client-side. It fetches audio
 * from a locally running OpenTTS server and returns it as a data URI.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput } from '@/types';

// This flow now encapsulates the CLIENT-SIDE logic for calling a local OpenTTS server.
// The actual fetch happens on the client, but the logic is defined here.

const synthesizeSpeechWithOpenTTSFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechWithOpenTTSFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>(),
  },
  async (input): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const openTtsUrl = 'http://localhost:5500/api/tts';

    try {
      // This fetch call is intended to be executed on the client,
      // which is why the page itself will handle it. This flow acts as a placeholder
      // and documentation for that logic.
      // The actual implementation is now on the page component.
      
      // The logic below is a representation of what the client will do.
      const response = await fetch(`${openTtsUrl}?voice=${encodeURIComponent(voiceProfileId || 'en-us_ljspeech')}&text=${encodeURIComponent(textToSpeak)}`);

      if (!response.ok) {
        throw new Error(`OpenTTS server returned an error: ${response.status} ${response.statusText}`);
      }

      // Correctly handle the audio data in a browser-compatible way
      const audioArrayBuffer = await response.arrayBuffer();
      const blob = new Blob([audioArrayBuffer], { type: 'audio/wav' });
      
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read blob as Data URL."));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const audioDataUri = await dataUrlPromise;
      
      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceProfileId,
      };

    } catch (error: any) {
      console.error(`Error in synthesizeSpeechWithOpenTTSFlow (client-side simulation):`, error);
      const errorMessage = `[OpenTTS Service Error]: Could not generate audio. Please ensure your local OpenTTS server is running and accessible at ${openTtsUrl}. Error: ${error.message}`;
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:${errorMessage}`,
        errorMessage: errorMessage,
        voiceProfileId: voiceProfileId,
      };
    }
  }
);


export async function synthesizeSpeechWithOpenTTS(input: z.infer<typeof SynthesizeSpeechInputSchema>): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    const openTtsUrl = 'http://localhost:5500/api/tts';
    const voiceToUse = voiceProfileId || 'en-us_ljspeech';

    // This is the actual client-side implementation
    try {
        // Correctly format the URL for a GET request as expected by OpenTTS
        const url = new URL(openTtsUrl);
        url.searchParams.append('voice', voiceToUse);
        url.searchParams.append('text', textToSpeak);

        const response = await fetch(url.toString(), {
             method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenTTS server returned an error: ${response.status} ${response.statusText}. Details: ${errorText}`);
        }

        const audioArrayBuffer = await response.arrayBuffer();
        const blob = new Blob([audioArrayBuffer], { type: 'audio/wav' });
        
        // Use URL.createObjectURL for direct playback without Base64 conversion overhead
        const audioUrl = URL.createObjectURL(blob);
        
        return {
            text: textToSpeak,
            audioDataUri: audioUrl, // This is a blob URL, e.g., "blob:http://localhost:9003/..."
            voiceProfileId: voiceToUse,
        };

    } catch (error: any) {
        console.error("Client-side OpenTTS fetch failed:", error);
        const errorMessage = `Could not connect to the local OpenTTS server. Please ensure the server is running and accessible at ${openTtsUrl}. (Details: ${error.message})`;
        return {
            text: textToSpeak,
            audioDataUri: `tts-flow-error:${errorMessage}`,
            errorMessage: errorMessage,
            voiceProfileId: voiceToUse,
        };
    }
}
