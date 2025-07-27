
'use server';
/**
 * @fileOverview Speech synthesis flow using Google's Gemini TTS model via Genkit.
 * Includes a retry mechanism with exponential backoff to handle transient errors like quota limits.
 */
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput, SynthesizeSpeechInput } from '@/types';
import wav from 'wav';

// Helper function to convert the raw PCM audio buffer from Gemini into a proper WAV format.
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

    const bufs: Buffer[] = [];
    writer.on('error', reject);
    writer.on('data', (chunk) => {
      bufs.push(chunk);
    });
    writer.on('end', () => {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

// Helper for adding a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: SynthesizeSpeechOutput,
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = voiceProfileId || 'Algenib'; // Default to a premium male voice
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
        try {
            console.log(`[TTS] Calling Gemini TTS model with voice: ${voiceToUse} (Attempt ${attempt + 1})`);
            
            const { media } = await ai.generate({
                model: 'googleai/gemini-2.5-flash-preview-tts',
                config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceToUse },
                    },
                },
                },
                prompt: textToSpeak,
            });

            if (!media || !media.url) {
                throw new Error('No media returned from the Gemini TTS model.');
            }
            
            const audioBuffer = Buffer.from(
                media.url.substring(media.url.indexOf(',') + 1),
                'base64'
            );
            
            const wavBase64 = await toWav(audioBuffer);
            const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

            // Success! Return the result.
            return {
                text: textToSpeak,
                audioDataUri: audioDataUri,
                voiceProfileId: voiceToUse,
            };

        } catch (err: any) {
            lastError = err;
            const errorMessage = err.message?.toLowerCase() || "";
            // Check for specific, retryable errors like quota or temporary server issues
            if (errorMessage.includes("quota") || errorMessage.includes("unavailable") || errorMessage.includes("503") || errorMessage.includes("resource has been exhausted")) {
                attempt++;
                const delayTime = Math.pow(2, attempt) * 100; // Exponential backoff: 200ms, 400ms, 800ms
                console.warn(`[TTS] Attempt ${attempt} failed with a retryable error: ${err.message}. Retrying in ${delayTime}ms...`);
                await delay(delayTime);
            } else {
                // Non-retryable error, break the loop immediately
                console.error("❌ Gemini TTS synthesis flow failed with a non-retryable error:", err);
                break;
            }
        }
    }
    
    // If all retries failed or a non-retryable error occurred
    console.error(`❌ Gemini TTS synthesis flow failed after ${attempt} attempts. Last error:`, lastError);
    let finalErrorMessage = `[TTS Service Error]: Could not generate audio after ${attempt} attempts.`;
    if (lastError?.message?.includes("API key")) {
        finalErrorMessage = "[TTS Auth Error]: The provided API key is invalid or lacks permissions for the Text-to-Speech API. Please check your Google Cloud project settings and API key validity.";
    } else if (lastError) {
        finalErrorMessage += ` Last error: ${lastError.message}`;
    }

    return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${finalErrorMessage}]`,
        errorMessage: finalErrorMessage,
        voiceProfileId: voiceToUse,
    };
  }
);


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  const parseResult = SynthesizeSpeechInputSchema.safeParse(input);
  if (!parseResult.success) {
      const errorMessage = `Input validation failed for speech synthesis: ${parseResult.error.format()}`;
      console.error("❌ synthesizeSpeech wrapper caught Zod error:", errorMessage);
       return {
        text: input.textToSpeak || "Invalid input",
        audioDataUri: `tts-flow-error:[${errorMessage}]`,
        errorMessage,
        voiceProfileId: input.voiceProfileId
      };
  }
  return await synthesizeSpeechFlow(input);
}
