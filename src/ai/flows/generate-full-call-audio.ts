
"use server";

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ConversationTurn, GenerateFullCallAudioInputSchema, GenerateFullCallAudioOutputSchema } from '@/types';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

/**
 * @fileOverview Generates a single audio file from a full conversation history.
 * This flow takes a structured conversation log and uses a multi-speaker TTS model
 * to create a cohesive audio recording of the entire interaction.
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

// Maps the frontend voice profile name to a specific Google TTS voice name.
const getAgentVoiceId = (profileId?: string): string => {
    // Default to 'Algenib' if no profileId is provided, which is a supported voice.
    return profileId || 'Algenib'; 
}


export const generateFullCallAudio = ai.defineFlow(
    {
        name: 'generateFullCallAudio',
        inputSchema: GenerateFullCallAudioInputSchema,
        outputSchema: GenerateFullCallAudioOutputSchema,
    },
    async (input) => {
        if (!input.singleSpeakerText && (!input.conversationHistory || input.conversationHistory.length === 0)) {
            return { audioDataUri: "", errorMessage: "Conversation history or single speaker text must be provided." };
        }

        try {
            let prompt: string;
            let config: any;

            if (input.singleSpeakerText) {
                prompt = input.singleSpeakerText;
                config = {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: getAgentVoiceId(input.agentVoiceProfile) },
                        },
                    },
                };
            } else {
                prompt = input.conversationHistory!.map(turn => {
                    const speakerLabel = turn.speaker === 'AI' ? 'Agent' : 'Customer';
                    return `${speakerLabel}: ${turn.text}`;
                }).join('\n');
                
                const agentVoiceName = getAgentVoiceId(input.agentVoiceProfile);
                // Assign a different, supported voice for the customer
                const customerVoiceName = "Enif"; 

                config = {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: [
                                {
                                    speaker: 'Agent',
                                    voiceConfig: { prebuiltVoiceConfig: { voiceName: agentVoiceName } },
                                },
                                {
                                    speaker: 'Customer',
                                    voiceConfig: { prebuiltVoiceConfig: { voiceName: customerVoiceName } },
                                },
                            ],
                        },
                    },
                };
            }

            const { media } = await ai.generate({
                model: googleAI.model('gemini-2.5-flash-preview-tts'),
                config: config,
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
                errorMessage: `Failed to generate audio: ${error.message}`,
            };
        }
    }
);
