
'use server';
/**
 * @fileOverview Speech synthesis flow using Google Cloud TTS via Genkit.
 * This flow synthesizes text into audible speech and returns a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(500, "Text to speak cannot exceed 500 characters."),
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

// Helper function to convert raw PCM buffer to WAV base64 string
async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));
    writer.on('finish', () => resolve(Buffer.concat(bufs).toString('base64')));

    writer.write(pcmData, (err) => {
        if(err) reject(err);
        writer.end();
    });
  });
}

async function synthesizeSpeechFlow(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    
    // Default to a high-quality voice if the profile ID is not provided or invalid
    const voiceToUse = voiceProfileId || "en-IN-Wavenet-B"; 

    console.log(`🎤 Google TTS Info: Attempting speech generation. Voice: ${voiceToUse}, Text (truncated): ${textToSpeak.substring(0, 50)}...`);

    try {
        const { media } = await ai.generate({
            model: googleAI.model('gemini-2.5-flash-preview-tts'),
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceToUse },
                    },
                    languageCode: 'en-IN'
                },
            },
            prompt: textToSpeak,
        });

        if (!media?.url) {
            throw new Error('Google TTS API did not return any media content.');
        }
        
        // The media.url from Gemini TTS is a data URI with raw PCM data
        const pcmDataBase64 = media.url.substring(media.url.indexOf(',') + 1);
        const pcmBuffer = Buffer.from(pcmDataBase64, 'base64');
        
        const wavBase64 = await toWav(pcmBuffer);
        const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

        if (!audioDataUri || audioDataUri.length < 1000) {
          throw new Error('Generated WAV data URI is invalid or too short.');
        }

        console.log(`✅ Google TTS Success: Generated playable WAV audio URI. Length: ${audioDataUri.length}`);

        return {
            text: textToSpeak,
            audioDataUri: audioDataUri,
            voiceProfileId: voiceToUse,
        };
    } catch (error: any) {
        const errorMessage = `Google TTS Generation FAILED. Error: ${error.message || 'Unknown error'}. Check API key, model access, and input parameters.`;
        console.error(`❌ ${errorMessage}`);
        return {
          text: textToSpeak,
          audioDataUri: `tts-flow-error:[${errorMessage}]`, // Error placeholder
          errorMessage: errorMessage,
          voiceProfileId: voiceProfileId,
        };
    }
}


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
    
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
