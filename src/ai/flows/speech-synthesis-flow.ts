
'use server';
/**
 * @fileOverview Speech synthesis flow.
 * This flow synthesizes text into audible speech and returns a Data URI.
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
  textToSpeak: z.string().min(1).describe('The text content to be synthesized into speech.'),
  voiceProfileId: z.string().optional().describe('Conceptual ID for a voice profile. Used to select a standard TTS voice.'),
  languageCode: z.string().default('en-IN').describe('BCP-47 language tag (e.g., "en-IN", "hi-IN").'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('Speaking rate/speed, 1.0 is normal.'),
  pitch: z.number().min(-20.0).max(20.0).optional().describe('Speaking pitch, 0.0 is normal.'),
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
    const { textToSpeak, voiceProfileId, languageCode, speakingRate, pitch } = input;
    
    try {
      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Algenib' },
            },
          },
        },
        prompt: textToSpeak,
      });

      if (!media) {
        throw new Error("AI did not return any media for speech synthesis.");
      }

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
        console.error("Error during speech synthesis AI call:", error);
        const errorMessage = `AI TTS API Error: ${error.message || 'Unknown error'}`;
        return {
            text: textToSpeak,
            audioDataUri: `tts-api-error:[${errorMessage}]`,
            voiceProfileId: voiceProfileId,
            errorMessage: errorMessage
        }
    }
  }
);

export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    return await synthesizeSpeechFlow(validatedInput);
  } catch (e) {
    const error = e as Error;
    let errorMessage = `Failed to prepare for speech synthesis: ${error.message}`;
    let descriptiveErrorUri = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'}) (Lang: ${input.languageCode})]: ${(input.textToSpeak || "No text provided").substring(0,50)}...`;

    if (e instanceof z.ZodError) {
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join('; ')}`;
        descriptiveErrorUri = `tts-input-validation-error:[Invalid Input for TTS (Profile: ${input.voiceProfileId || 'Default'}) (Lang: ${input.languageCode})]: ${(input.textToSpeak || "No text").substring(0,30)}...`;
    }
    
    console.error("Error in synthesizeSpeech:", error);
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: descriptiveErrorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
