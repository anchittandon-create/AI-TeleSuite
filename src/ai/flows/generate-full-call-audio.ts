
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

// This is a server-side list of high-quality voices to ensure consistency.
// It maps the user-friendly names from the browser to specific Google TTS voice IDs.
const VOICE_PROFILE_MAP: Record<string, { voiceId: string, gender: 'male' | 'female', lang: string }> = {
    'Indian English - Female (Professional)': { voiceId: 'en-IN-Wavenet-D', gender: 'female', lang: 'en-IN' },
    'US English - Female (Professional)': { voiceId: 'en-US-Wavenet-F', gender: 'female', lang: 'en-US' },
    'Indian Hindi - Female': { voiceId: 'hi-IN-Wavenet-A', gender: 'female', lang: 'hi-IN' },
    'Indian English - Male (Professional)': { voiceId: 'en-IN-Wavenet-C', gender: 'male', lang: 'en-IN' },
    'US English - Male (Professional)': { voiceId: 'en-US-Wavenet-D', gender: 'male', lang: 'en-US' },
    'Indian Hindi - Male': { voiceId: 'hi-IN-Wavenet-B', gender: 'male', lang: 'hi-IN' },
};


const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()),
    // The `aiVoice` parameter now directly holds the user-friendly profile name from the UI dropdown.
    aiVoice: z.string().optional().describe('The user-friendly voice profile name selected for the AI during the call.'),
    userVoice: z.string().optional().describe('The voice for the user. Defaults to a standard voice.'),
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
    async ({ conversationHistory, aiVoice }) => {
        if (!conversationHistory || conversationHistory.length === 0) {
            return { audioDataUri: "" };
        }
        
        // Determine Speaker1's (AI) voice from the map.
        const selectedProfile = aiVoice ? VOICE_PROFILE_MAP[aiVoice] : undefined;
        const speaker1VoiceName = selectedProfile ? selectedProfile.voiceId : 'en-IN-Wavenet-D'; // Default AI voice if not found

        // Determine Speaker2's (User) voice. This provides a contrasting standard voice.
        const speaker2VoiceName = speaker1VoiceName.startsWith('en-IN') ? 'en-US-Standard-E' : 'en-IN-Standard-A';

        // Create a multi-speaker prompt for the TTS engine.
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
                            { speaker: 'Speaker1', voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1VoiceName } } },
                            { speaker: 'Speaker2', voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2VoiceName } } },
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
