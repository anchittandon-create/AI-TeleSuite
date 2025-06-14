
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
// ================================================================================================
// IMPORTANT: Google Cloud Authentication for Text-to-Speech Client
// ================================================================================================
// The TextToSpeechClient requires proper authentication with Google Cloud.
// The most common ways this is handled in a Node.js server environment are:
// 1.  **Application Default Credentials (ADC) via Service Account Key:**
//     - Create a service account in your Google Cloud project.
//     - Grant this service account the "Cloud Text-to-Speech API User" role (or a more permissive role like Owner/Editor, though less recommended for production).
//     - Download the JSON key file for this service account.
//     - Set the environment variable `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of this JSON key file.
//     - Example: `GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"`
//     - This is the **RECOMMENDED** method for server-side applications.
//
// 2.  **API Key (Less Secure for Server-Side, More Common for Client-Side Restricted Keys):**
//     - Ensure your `GOOGLE_API_KEY` environment variable is set.
//     - The Cloud Text-to-Speech API must be **ENABLED** in the Google Cloud project associated with this API key.
//     - Billing must be enabled for the project.
//     - The API key must be unrestricted or have restrictions that allow the Text-to-Speech API.
//     - The client library *may* pick up this key if ADC is not found, but ADC is generally preferred.
//
// 3.  **Running in a Google Cloud Environment (e.g., Cloud Run, GKE, GCE):**
//     - If your application is running within a Google Cloud environment, the client library can often
//       automatically use the credentials associated with the service account of that environment,
//       provided that service account has the necessary permissions for Text-to-Speech.
//
// Common Errors & Solutions:
// - "Could not refresh access token" / "Request failed with status code 500" / "Permission denied" / "API key not valid":
//   These almost always point to an authentication or permissions issue.
//   - Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct and the JSON key is valid.
//   - Ensure the service account has the "Cloud Text-to-Speech API User" role.
//   - If using `GOOGLE_API_KEY`, ensure it's correct, unrestricted (or correctly restricted), and the API is enabled & billed.
//   - Double-check that the "Cloud Text-to-Speech API" is enabled in your Google Cloud Console.
//   - Ensure billing is active on your Google Cloud project.
// ================================================================================================
let ttsClient: TextToSpeechClient | null = null;
try {
    ttsClient = new TextToSpeechClient();
    console.info("TextToSpeechClient initialized successfully. It will attempt to use Google Cloud credentials from the environment (GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_API_KEY if applicable).");
} catch (error) {
    console.error("CRITICAL: Failed to initialize TextToSpeechClient. Real speech synthesis WILL FAIL. Check Google Cloud authentication setup. Error:", error);
    // The flow will still attempt to run but will likely hit an error when ttsClient is used.
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
    if (voiceProfileId) {
        if (voiceProfileId.toLowerCase().includes("female")) {
            if (languageCode.startsWith("en")) voiceName = 'en-IN-Wavenet-C'; 
            else if (languageCode.startsWith("hi")) voiceName = 'hi-IN-Wavenet-C'; 
        } else if (voiceProfileId.toLowerCase().includes("male")) {
             if (languageCode.startsWith("en")) voiceName = 'en-IN-Wavenet-B'; 
             else if (languageCode.startsWith("hi")) voiceName = 'hi-IN-Wavenet-B'; 
        }
    } else { 
        if (languageCode.startsWith("hi")) voiceName = 'hi-IN-Wavenet-A'; 
    }


    if (!ttsClient) {
        const initErrorMessage = "TextToSpeechClient failed to initialize. Check server logs for details. This usually means Google Cloud authentication (e.g., GOOGLE_APPLICATION_CREDENTIALS or a valid GOOGLE_API_KEY with Text-to-Speech API enabled) is not set up correctly or the Cloud Text-to-Speech API is not enabled in your project.";
        console.error(initErrorMessage);
        const placeholderError = `tts-simulation-error:[TTS Client Not Initialized (Profile: ${voiceProfileId || 'Default'}) (Lang: ${languageCode})]: ${textToSpeak.substring(0,50)}...`;
        return {
            text: textToSpeak,
            audioDataUri: placeholderError,
            voiceProfileId: voiceProfileId,
            errorMessage: initErrorMessage,
        };
    }

    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text: textToSpeak },
      voice: {
        languageCode: languageCode,
        name: voiceName, 
      },
      audioConfig: {
        audioEncoding: 'MP3', 
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
      const errorDetailsString = error.details || (error.error ? JSON.stringify(error.error) : '');

      if (error.code === 7 || errorDetailsString.toLowerCase().includes('permission denied') || errorDetailsString.toLowerCase().includes('api key not valid') || errorDetailsString.toLowerCase().includes('could not refresh access token')) {
        detailedErrorMessage = `Permission denied or authentication failed with Google Cloud Text-to-Speech API. Details: ${errorDetailsString || error.message}. Please ensure: 1) The Cloud Text-to-Speech API is ENABLED in your Google Cloud project. 2) Billing is ENABLED for the project. 3) If using a service account (via GOOGLE_APPLICATION_CREDENTIALS), it has the 'Cloud Text-to-Speech API User' role. 4) If relying on an API key (GOOGLE_API_KEY), it's valid and unrestricted or correctly restricted for TTS. Status code: ${error.code || 'N/A'}`;
      } else if (error.code === 5) {
        detailedErrorMessage = "TTS API resource exhausted (e.g. quota exceeded). Please check your Google Cloud project quotas.";
      } else if (error.message?.toLowerCase().includes("could not authenticate request")) {
        detailedErrorMessage = "TTS API Authentication Failed. Ensure your GOOGLE_APPLICATION_CREDENTIALS (service account key) is correctly set up and valid, or that your GOOGLE_API_KEY is correct and the TTS API is enabled for it.";
      } else if (error.message?.toLowerCase().includes("getting metadata from plugin failed")) { // Specific to the user's screenshot
         detailedErrorMessage = `Google TTS Error (Code ${error.code || 'N/A'}): "${error.message}". This often relates to authentication ("Could not refresh access token") or project configuration. Please verify: 1. Cloud Text-to-Speech API is ENABLED. 2. Billing is ACTIVE. 3. Credentials (Service Account Key via GOOGLE_APPLICATION_CREDENTIALS or a valid GOOGLE_API_KEY) are correctly set and have permissions. Original details: ${errorDetailsString}`;
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
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    return await synthesizeSpeechFlow(validatedInput);
  } catch (e) {
    const error = e as Error;
    console.error("Error in synthesizeSpeech exported function (validation or catastrophic flow error):", error);
    let descriptiveError = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'}) (Lang: ${input.languageCode})]: ${(input.textToSpeak || "No text").substring(0,50)}...`;
    let errorMessage = `Failed to synthesize speech: ${error.message}`;
    if (e instanceof z.ZodError) {
        descriptiveError = `tts-input-validation-error:[Invalid input to TTS flow for text: "${(input.textToSpeak || "").substring(0,30)}..."]: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join(', ')}`;
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => err.message).join('; ')}`;
    }
    return {
      text: input.textToSpeak || "Error: No text provided due to input validation failure",
      audioDataUri: descriptiveError,
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
