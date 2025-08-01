
'use server';
/**
 * @fileOverview Generates a single audio file from a full conversation history.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ConversationTurn } from '@/types';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()),
});

const GenerateFullCallAudioOutputSchema = z.object({
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio for the full call ('data:audio/wav;base64,...').")
});

export const generateFullCallAudio = ai.defineFlow(
    {
        name: 'generateFullCallAudio',
        inputSchema: GenerateFullCallAudioInputSchema,
        outputSchema: GenerateFullCallAudioOutputSchema,
    },
    async ({ conversationHistory }) => {
        if (!conversationHistory || conversationHistory.length === 0) {
            return { audioDataUri: "" };
        }
        
        // Create a multi-speaker prompt
        const prompt = conversationHistory.map(turn => {
            const speakerLabel = turn.speaker === 'AI' ? 'Speaker1' : 'Speaker2';
            return `${speakerLabel}: ${turn.text}`;
        }).join('\n');

        const { media } = await ai.generate({
            model: googleAI.model('gemini-2.5-flash-preview-tts'),
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: [
                            { speaker: 'Speaker1', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Algenib' } } },
                            { speaker: 'Speaker2', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Achernar' } } },
                        ],
                    },
                },
            },
            prompt,
        });

        if (!media) {
            throw new Error('Full call audio generation failed: no media returned from TTS model.');
        }

        const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
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
