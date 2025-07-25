
'use server';
/**
 * @fileOverview Speech synthesis flow.
 * This flow synthesizes text into audible speech using a selected voice profile
 * and returns a Data URI. It includes validation and fallback logic.
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
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(500, "Text to speak cannot exceed 500 characters."),
  voiceProfileId: z.string().optional().describe('The ID of the pre-built voice to use for synthesis (e.g., "en-IN-Standard-A", "en-IN-Wavenet-B").'),
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
    const { textToSpeak } = input;
    
    const validVoices = new Set(["en-IN-Standard-A", "en-IN-Wavenet-B", "en-IN-Standard-C", "en-IN-Wavenet-D"]);
    const fallbackVoice = "en-IN-Standard-A";
    
    let voiceToUse = input.voiceProfileId;
    
    // 🛡️ Voice Validation Logic (Pre-TTS Trigger)
    if (!voiceToUse || !validVoices.has(voiceToUse)) {
      console.warn(`⚠️ TTS Warning: Invalid or missing voiceProfileId '${voiceToUse}'. Falling back to default voice '${fallbackVoice}'.`);
      voiceToUse = fallbackVoice; 
    }
    
    console.log(`🎤 TTS Info: Attempting speech generation. Text: "${textToSpeak.substring(0,50)}...", Voice: ${voiceToUse}`);

    try {
      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceToUse },
            },
            languageCode: 'en-IN',
          },
        },
        prompt: textToSpeak,
      });

      if (!media || !media.url) {
        throw new Error("AI did not return any media for speech synthesis.");
      }

      // 📊 Log the raw URI prefix and length for debugging
      console.log(`🔊 TTS Success: Raw data URI received. Length: ${media.url.length}, Prefix: ${media.url.substring(0, 30)}`);

      // The media.url from TTS is a data URI with raw PCM data. We must convert it to WAV.
      const audioBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      
      const wavBase64 = await toWav(audioBuffer);
      const audioDataUri = `data:audio/wav;base64,${wavBase64}`;
      
      // ✅ Final validation of generated URI
      if (!audioDataUri.startsWith("data:audio/wav;base64,") || audioDataUri.length < 1000) {
        throw new Error(`WAV conversion produced an invalid data URI. Length: ${audioDataUri.length}`);
      }

      console.log(`✅ TTS Pipeline Success: Generated and validated playable WAV audio URI. Length: ${audioDataUri.length}`);

      return {
        text: textToSpeak,
        audioDataUri: audioDataUri,
        voiceProfileId: voiceToUse,
      };

    } catch (error: any) {
        console.error(`❌ TTS Generation/Processing FAILED for voice '${voiceToUse}'. Error:`, error);
        const errorMessage = `AI TTS API Error: ${error.message || 'Unknown error'}. Please check server logs and API key validity.`;
        // Throw the error so the calling function can handle it and create a proper error response object.
        throw new Error(errorMessage);
    }
  }
);


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    // 1. ✅ Validate input schema before calling the flow
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    return await synthesizeSpeechFlow(validatedInput);
  } catch (e: any) {
    // This catches errors from both Zod validation and the flow itself (including the thrown AI error).
    let errorMessage = `Failed to synthesize speech: ${e.message}`;
    const errorUri = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'})]: ${(input.textToSpeak || "No text provided").substring(0,50)}...`;

    if (e instanceof z.ZodError) {
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join('; ')}`;
    }
    
    console.error("❌ synthesizeSpeech wrapper caught error:", errorMessage);
    
    // Return a structured error object that conforms to the schema.
    // ⛔ Do not return a real audio URI, but a placeholder that the frontend can identify as an error.
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
