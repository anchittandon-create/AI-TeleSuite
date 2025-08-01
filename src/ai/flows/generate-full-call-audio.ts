
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

const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()),
    aiVoice: z.string().optional().describe('The AI agent voice ID from the UI (e.g., algenib).'),
    customerVoice: z.string().optional().describe('The Customer voice ID for the final recording (e.g., charon).'),
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
    async ({ conversationHistory, aiVoice, customerVoice }) => {
        if (!conversationHistory || conversationHistory.length === 0) {
            return { audioDataUri: "" };
        }
        
        console.log("Generating full call audio. AI Voice:", aiVoice, "Customer Voice:", customerVoice);

        // Filter out any turns that might have empty text to prevent TTS errors
        const validTurns = conversationHistory.filter(turn => turn.text && turn.text.trim().length > 0);

        if (validTurns.length === 0) {
            console.warn("No valid conversation turns with text to synthesize.");
            return { audioDataUri: "" };
        }

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
          prompt: validTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'),
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
