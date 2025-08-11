
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
    agentVoiceProfile: z.string().optional().describe("The voice profile ID from Google's catalog (e.g., 'en-IN-Wavenet-D')."),
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
// These voices are supported by the `gemini-2.5-flash-preview-tts` model.
const getAgentVoiceId = (profileId?: string): string => {
    // This flow now receives the direct Google Voice ID.
    // We can add a mapping layer here if needed, but for now we pass it through.
    // Default to a high-quality voice if none is provided.
    return profileId || 'Algenib'; 
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
            
            // The agent voice is now directly passed in, or we use a default
            const agentVoiceName = getAgentVoiceId(input.agentVoiceProfile); 
            // Using a distinct, high-quality voice for the customer
            const customerVoiceName = "Rasalgethi"; 

            const { media } = await ai.generate({
                model: googleAI.model('gemini-2.5-flash-preview-tts'),
                config: {
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
