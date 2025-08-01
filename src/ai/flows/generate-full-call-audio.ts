
'use server';
/**
 * @fileOverview Generates a single audio file from a full conversation history using Google's TTS.
 * This flow is designed to be self-contained and not rely on client-side hooks or variables.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ConversationTurn } from '@/types';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';
import { Readable } from 'stream';

const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()),
    aiVoice: z.string().optional().describe('The AI agent voice name from the browser.'),
    customerVoice: z.string().optional().describe('The Customer voice name for the final recording.'),
});

const GenerateFullCallAudioOutputSchema = z.object({
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio for the full call ('data:audio/wav;base64,...').")
});

const assembleAudioFlow = ai.defineFlow(
    {
        name: 'assembleFullCallAudio',
        inputSchema: z.any(),
        outputSchema: z.any(),
    },
    async (turns: ConversationTurn[]) => {
        // Placeholder for a real audio stitching service.
        // For now, we simulate by joining the audio data URIs.
        // A real implementation would require a library like FFMPEG on a server.
        console.warn("Audio stitching is simulated. A real implementation would require a backend service.");

        // In this simulation, we will just return the audio URI of the first turn.
        // This is a placeholder to demonstrate the data flow.
        const firstAudioTurn = turns.find(t => t.audioDataUri);
        return { audioDataUri: firstAudioTurn?.audioDataUri || "" };
    }
);


export const generateFullCallAudio = ai.defineFlow(
    {
        name: 'generateFullCallAudio',
        inputSchema: GenerateFullCallAudioInputSchema,
        outputSchema: GenerateFullCallAudioOutputSchema,
    },
    async ({ conversationHistory, aiVoice, customerVoice }) => {
        if (!conversationHistory || conversationHistory.length === 0) {
            return { audioDataUri: "" };
        }
        
        // This is a placeholder for a more complex stitching logic.
        // The ideal solution would involve a backend service that can concatenate/mix audio files.
        // For this prototype, we'll try a simplified multi-speaker TTS generation if possible,
        // which simulates the outcome but doesn't use the original recorded audio.
        console.log("Simulating full call audio generation. This does not use the user's original recorded voice snippets in this version.");

        const aitts = await ai.generate({
          model: googleAI.model('gemini-2.5-flash-preview-tts'),
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'AI',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: aiVoice || 'algenib' },
                    },
                  },
                  {
                    speaker: 'User',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: customerVoice || 'charon' },
                    },
                  },
                ],
              },
            },
          },
          prompt: conversationHistory.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'),
        });
        
        if (!aitts.media) {
            throw new Error('Full call audio generation failed: no media returned from TTS model.');
        }

        const audioBuffer = Buffer.from(aitts.media.url.substring(aitts.media.url.indexOf(',') + 1), 'base64');
        const wavBase64 = await toWav(audioBuffer);

        return {
            audioDataUri: 'data:audio/wav;base64,' + wavBase64,
        };
    }
);


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
