
"use server";

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ConversationTurn } from '@/types';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

/**
 * @fileOverview Generates a single audio file from a full conversation history.
 * This flow takes a structured conversation log and uses a multi-speaker TTS model
 * to create a cohesive audio recording of the entire interaction.
 */

const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()).describe("The full history of the conversation, with 'AI' and 'User' speakers."),
    agentVoiceProfile: z.string().optional().describe("The voice profile name selected for the agent on the frontend (e.g., 'Indian English - Female (Professional)')."),
});

const GenerateFullCallAudioOutputSchema = z.object({
    audioDataUri: z.string().describe("The Data URI of the generated WAV audio file for the full call."),
    errorMessage: z.string().optional(),
});

export type GenerateFullCallAudioInput = z.infer<typeof GenerateFullCallAudioInputSchema>;
export type GenerateFullCallAudioOutput = z.infer<typeof GenerateFullCallAudioOutputSchema>;


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

// Maps the frontend voice profile name to a specific Google TTS voice name.
const getAgentVoiceId = (profileName?: string): string => {
    switch (profileName) {
        case 'Indian English - Female (Professional)': return 'en-IN-Wavenet-D';
        case 'Indian English - Female (Standard)': return 'en-IN-Wavenet-A';
        case 'Indian English - Male (Standard)': return 'en-IN-Wavenet-B';
        case 'Indian English - Male (Warm)': return 'en-IN-Wavenet-C';
        case 'US English - Female (Professional)': return 'en-US-Wavenet-F';
        case 'US English - Female (Calm)': return 'en-US-Wavenet-E';
        case 'US English - Male (Standard)': return 'en-US-Wavenet-D';
        case 'US English - Male (Warm)': return 'en-US-Wavenet-A';
        case 'Indian Hindi - Female': return 'hi-IN-Wavenet-A';
        case 'Indian Hindi - Male': return 'hi-IN-Wavenet-B';
        default: return 'en-IN-Wavenet-D'; // A high-quality default
    }
}


export const generateFullCallAudio = ai.defineFlow(
    {
        name: 'generateFullCallAudio',
        inputSchema: GenerateFullCallAudioInputSchema,
        outputSchema: GenerateFullCallAudioOutputSchema,
    },
    async (input) => {
        if (!input.conversationHistory || input.conversationHistory.length === 0) {
            return { audioDataUri: "", errorMessage: "Conversation history is empty." };
        }

        try {
            // Construct the multi-speaker prompt
            const prompt = input.conversationHistory.map(turn => {
                const speakerLabel = turn.speaker === 'AI' ? 'Agent' : 'Customer';
                return `${speakerLabel}: ${turn.text}`;
            }).join('\n');
            
            const agentVoice = getAgentVoiceId(input.agentVoiceProfile); 
            // Using a distinct, high-quality voice for the customer
            const customerVoice = "en-US-Studio-O"; 

            const { media } = await ai.generate({
                model: googleAI.model('gemini-2.5-flash-preview-tts'),
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: [
                                {
                                    speaker: 'Agent',
                                    voiceConfig: { prebuiltVoiceConfig: { voiceName: agentVoice } },
                                },
                                {
                                    speaker: 'Customer',
                                    voiceConfig: { prebuiltVoiceConfig: { voiceName: customerVoice } },
                                },
                            ],
                        },
                    },
                },
                prompt: prompt,
            });

            if (!media) {
                throw new Error('No media returned from TTS model');
            }
            
            const audioBuffer = Buffer.from(
                media.url.substring(media.url.indexOf(',') + 1),
                'base64'
            );

            const wavBase64 = await toWav(audioBuffer);

            return { audioDataUri: `data:audio/wav;base64,${wavBase64}` };

        } catch (error: any) {
            console.error("Error in generateFullCallAudio flow:", error);
            return {
                audioDataUri: "",
                errorMessage: `Failed to generate full call audio: ${error.message}`,
            };
        }
    }
);
