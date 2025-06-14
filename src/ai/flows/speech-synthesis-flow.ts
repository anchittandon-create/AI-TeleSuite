
'use server';
/**
 * @fileOverview Speech synthesis flow using Google Cloud Text-to-Speech.
 * This flow synthesizes text into audible speech and returns it as a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes audioDataUri.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';

const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1).describe('The text content to be synthesized into speech.'),
  voiceProfileId: z.string().optional().describe('Conceptual ID for a voice profile. Used to select a standard TTS voice.'),
  languageCode: z.string().default('en-IN').describe('BCP-47 language tag (e.g., "en-IN", "hi-IN").'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('Speaking rate/speed, 1.0 is normal.'),
  pitch: z.number().min(-20.0).max(20.0).optional().describe('Speaking pitch, 0.0 is normal.'),
});
export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

const SynthesizeSpeechOutputSchema = z.object({
    text: z.string().describe("The original text that was intended for speech synthesis."),
    audioDataUri: z.string().describe("A data URI representing the synthesized audio (e.g., 'data:audio/mp3;base64,...') or an error message placeholder if synthesis failed."),
    voiceProfileId: z.string().optional().describe("The voice profile ID that was passed in, if any."),
    errorMessage: z.string().optional().describe("Any error message if the synthesis failed."),
});
export type SynthesizeSpeechOutput = z.infer<typeof SynthesizeSpeechOutputSchema>;

// Initialize the TextToSpeechClient.
// IMPORTANT: For this to work, your environment needs to be configured for Google Cloud authentication.
// This typically involves setting the GOOGLE_APPLICATION_CREDENTIALS environment variable
// to the path of your service account key JSON file, or ensuring the GOOGLE_API_KEY
// environment variable is set and the Cloud Text-to-Speech API is enabled for that key/project.
// The client library will attempt to use these credentials.
let ttsClient: TextToSpeechClient | null = null;
try {
    ttsClient = new TextToSpeechClient();
    console.info("TextToSpeechClient initialized successfully.");
} catch (error) {
    console.error("Failed to initialize TextToSpeechClient. Real speech synthesis will likely fail.", error);
    // The flow will still attempt to run but will probably hit an error when ttsClient is used.
}


const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutputSchema,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId, languageCode, speakingRate, pitch } = input;
    
    let voiceName = 'en-IN-Wavenet-D'; // Default high-quality English (India) voice
    // Basic mapping for conceptual voiceProfileId to actual Google TTS voice names
    // This can be expanded significantly based on available Google voices and desired profiles
    if (voiceProfileId) {
        if (voiceProfileId.toLowerCase().includes("female")) {
            if (languageCode.startsWith("en")) voiceName = 'en-IN-Wavenet-C'; // Another female English (India)
            else if (languageCode.startsWith("hi")) voiceName = 'hi-IN-Wavenet-C'; // Female Hindi
        } else if (voiceProfileId.toLowerCase().includes("male")) {
             if (languageCode.startsWith("en")) voiceName = 'en-IN-Wavenet-B'; // Male English (India)
             else if (languageCode.startsWith("hi")) voiceName = 'hi-IN-Wavenet-B'; // Male Hindi
        }
        // Add more sophisticated mapping if needed
    } else { // Fallback based on languageCode if no profileId
        if (languageCode.startsWith("hi")) voiceName = 'hi-IN-Wavenet-A'; // Standard Hindi if no profile specified
    }


    if (!ttsClient) {
        console.error("TTS Client not initialized. Returning placeholder.");
        const placeholderError = `tts-simulation-error:[TTS Client Not Initialized (Profile: ${voiceProfileId || 'Default'}) (Lang: ${languageCode})]: ${textToSpeak.substring(0,50)}...`;
        return {
            text: textToSpeak,
            audioDataUri: placeholderError,
            voiceProfileId: voiceProfileId,
            errorMessage: "TextToSpeechClient failed to initialize. Check server logs. API key or credentials might be missing/invalid, or the Cloud Text-to-Speech API is not enabled.",
        };
    }

    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text: textToSpeak },
      voice: {
        languageCode: languageCode,
        name: voiceName, 
      },
      audioConfig: {
        audioEncoding: 'MP3', // MP3 is widely compatible
        speakingRate: speakingRate,
        pitch: pitch,
      },
    };

    try {
      const [response] = await ttsClient.synthesizeSpeech(request);
      if (response.audioContent instanceof Uint8Array) {
        const audioBase64 = Buffer.from(response.audioContent).toString('base64');
        const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
        return {
          text: textToSpeak,
          audioDataUri: audioDataUri,
          voiceProfileId: voiceProfileId,
        };
      } else {
        throw new Error('Audio content is not in the expected format (Uint8Array).');
      }
    } catch (error: any) {
      console.error('Google Cloud Text-to-Speech API error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      let detailedErrorMessage = error.message || 'Unknown TTS API error.';
      if (error.code === 7 && error.details?.includes('API key not valid')) {
        detailedErrorMessage = "Permission denied. The API key is invalid or missing required permissions for Cloud Text-to-Speech API. Ensure the API is enabled and the key is correct.";
      } else if (error.code === 7) {
        detailedErrorMessage = `Permission denied by TTS API. This might be due to incorrect API key setup, disabled Text-to-Speech API in your Google Cloud project, or billing issues. Original details: ${error.details || error.message}`;
      } else if (error.code === 5) {
        detailedErrorMessage = "TTS API resource exhausted (e.g. quota exceeded). Please check your Google Cloud project quotas.";
      } else if (error.message?.toLowerCase().includes("could not authenticate request")) {
        detailedErrorMessage = "TTS API Authentication Failed. Ensure your GOOGLE_API_KEY (or GOOGLE_APPLICATION_CREDENTIALS) is correctly set up for server-side Google Cloud API calls.";
      }

      const placeholderError = `tts-api-error:[TTS API Call Failed (Profile: ${voiceProfileId || 'Default'}) (Lang: ${languageCode})]: ${textToSpeak.substring(0,50)}...`;
      return {
        text: textToSpeak,
        audioDataUri: placeholderError,
        voiceProfileId: voiceProfileId,
        errorMessage: `TTS Error: ${detailedErrorMessage}`,
      };
    }
  }
);

export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    // Input validation is done by Zod in defineFlow, but good practice if called directly
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    return await synthesizeSpeechFlow(validatedInput);
  } catch (e) {
    const error = e as Error;
    console.error("Error in synthesizeSpeech exported function:", error);
    let descriptiveError = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'}) (Lang: ${input.languageCode})]: ${(input.textToSpeak || "No text").substring(0,50)}...`;
    if (e instanceof z.ZodError) {
        descriptiveError = `tts-input-validation-error:[Invalid input to TTS flow]: ${(input.textToSpeak || "").substring(0,50)}...`;
    }
    return {
      text: input.textToSpeak || "Error: No text provided",
      audioDataUri: descriptiveError,
      errorMessage: `Failed to synthesize speech: ${error.message}`,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
