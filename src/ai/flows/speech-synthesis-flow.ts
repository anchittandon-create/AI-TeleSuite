
'use server';
/**
 * @fileOverview Speech synthesis flow using Google's Gemini TTS model.
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

const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(1000, "Text to speak cannot exceed 1000 characters."),
  voiceProfileId: z.string().optional().describe('The ID of the pre-built voice to use for synthesis (e.g., a voice name supported by the TTS engine).'),
});
export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

const SynthesizeSpeechOutputSchema = z.object({
    text: z.string().describe("The original text that was intended for speech synthesis."),
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio (e.g., 'data:audio/wav;base64,...') or an error message placeholder if synthesis failed."),
    voiceProfileId: z.string().optional().describe("The voice profile ID that was actually used for synthesis."),
    errorMessage: z.string().optional().describe("Any error message if the synthesis had an issue."),
});
export type SynthesizeSpeechOutput = z.infer<typeof SynthesizeSpeechOutputSchema>;


/**
 * Converts raw PCM audio data into a Base64-encoded WAV data URI.
 * @param pcmData The raw audio buffer from the TTS model.
 * @param channels The number of audio channels.
 * @param sampleRate The sample rate of the audio.
 * @param sampleWidth The width of each audio sample in bytes.
 * @returns A promise that resolves with the Base64 encoded WAV string.
 */
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

    let bufs: any[] = [];
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


const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutputSchema,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    
    // Fallback to a reliable default voice if the provided one is invalid or missing.
    const voiceToUse = voiceProfileId || "Salina"; 
    
    console.log(`🎤 TTS Info: Attempting speech generation. Voice: ${voiceToUse}, Text (truncated): ${textToSpeak.substring(0, 50)}...`);

    try {
      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        prompt: textToSpeak,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { 
                voiceName: voiceToUse,
                languageCode: "en-IN" // Ensure language code is always provided.
              },
            },
          },
        },
      });

      if (!media || !media.url) {
        throw new Error("TTS service returned no media content.");
      }

      // The Gemini TTS model returns raw PCM data in a data URI. We need to extract it and encode it as a proper WAV file.
      const pcmAudioBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      
      const wavBase64 = await toWav(pcmAudioBuffer);
      const audioDataUri = `data:audio/wav;base64,${wavBase64}`;
      
      console.log(`✅ TTS Success: Generated playable WAV audio URI. Length: ${audioDataUri.length}`);

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (error: any) {
        const errorMessage = `TTS Generation FAILED for voice '${voiceToUse}'. Error: ${error.message || 'Unknown error'}. Check server logs, API key, and model access.`;
        console.error(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
    }
  }
);


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    
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
    
    // Return a structured error object instead of throwing, so the caller can handle it gracefully.
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
