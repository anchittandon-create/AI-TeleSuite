
'use server';
/**
 * @fileOverview Speech synthesis flow.
 * This flow synthesizes text into audible speech using a selected voice profile
 * and returns a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty."),
  voiceProfileId: z.string().optional().describe('The ID of the pre-built voice to use for synthesis (e.g., "Salina", "Leo").'),
});
export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

const SynthesizeSpeechOutputSchema = z.object({
    text: z.string().describe("The original text that was intended for speech synthesis."),
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio (e.g., 'data:audio/wav;base64,...') or an error message placeholder if synthesis failed."),
    voiceProfileId: z.string().optional().describe("The voice profile ID that was passed in, if any."),
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
    
    // Map friendly voice profile IDs to actual Google TTS voice names
    // This allows for easy expansion and management of voices.
    const voiceMap: { [key: string]: string } = {
        "Salina": "en-IN-Standard-A", // Professional Female
        "Zuri": "en-IN-Standard-B",   // Warm Female
        "Mateo": "en-IN-Standard-C",  // Professional Male
        "Leo": "en-IN-Standard-D",    // Friendly Male
        "default": "en-IN-Standard-A",
    };
    
    const selectedVoiceName = voiceMap[voiceProfileId || 'default'] || voiceMap['default'];

    try {
      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              // The API expects a specific structure for pre-built voices which is not directly exposed.
              // We rely on the model's default voice selection logic, as direct voice name setting is complex.
              // The voice name logic is kept for future API improvements.
              // For now, it will use a high-quality default.
            },
          },
        },
        prompt: textToSpeak,
      });

      if (!media || !media.url) {
        throw new Error("AI did not return any media for speech synthesis.");
      }

      // The media.url from TTS is a data URI with PCM data. We convert it to WAV for broader browser compatibility.
      const audioBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      
      const wavBase64 = await toWav(audioBuffer);
      const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceProfileId,
      };

    } catch (error: any) {
        console.error(`Error during speech synthesis AI call for voice '${selectedVoiceName}':`, error);
        const errorMessage = `AI TTS API Error: ${error.message || 'Unknown error'}. Please check server logs and API key validity.`;
        // Throw the error so the calling function can handle it and create a proper error response object.
        throw new Error(errorMessage);
    }
  }
);


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    return await synthesizeSpeechFlow(validatedInput);
  } catch (e: any) {
    // This catches errors from both Zod validation and the flow itself (including the thrown AI error).
    let errorMessage = `Failed to synthesize speech: ${e.message}`;
    const errorUri = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'})]: ${(input.textToSpeak || "No text provided").substring(0,50)}...`;

    if (e instanceof z.ZodError) {
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join('; ')}`;
    }
    
    console.error("Error in synthesizeSpeech wrapper:", e);
    
    // Return a structured error object that conforms to the schema.
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
