
'use server';
/**
 * @fileOverview Generates a single audio file from a full conversation history.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ConversationTurn } from '@/types';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

// Import curated voice lists to find voice details
import { GOOGLE_PRESET_VOICES, BARK_PRESET_VOICES } from '@/hooks/use-voice-samples';
import { CuratedVoice as BrowserCuratedVoice, CURATED_VOICE_PROFILES } from '@/hooks/useSpeechSynthesis';

const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()),
    aiVoice: z.string().optional().describe('The voiceURI or ID of the AI voice used during the call.'),
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
        
        const allPresetVoices = [...GOOGLE_PRESET_VOICES, ...BARK_PRESET_VOICES];
        const selectedAiVoice = allPresetVoices.find(v => v.id === aiVoice);

        // This finds the full profile from the useSpeechSynthesis hook's list
        const selectedBrowserVoiceProfile = CURATED_VOICE_PROFILES.find(v => v.name === aiVoice);


        // Speaker 1 is always the AI
        let speaker1VoiceName: string | undefined;
        if(selectedAiVoice) {
            speaker1VoiceName = selectedAiVoice.id;
        } else if (selectedBrowserVoiceProfile) {
            // Logic to select a Google TTS voice that best matches the browser voice's profile
            if(selectedBrowserVoiceProfile.lang.startsWith('en-IN')) {
                speaker1VoiceName = selectedBrowserVoiceProfile.gender === 'female' ? 'en-IN-Wavenet-D' : 'en-IN-Wavenet-C';
            } else if (selectedBrowserVoiceProfile.lang.startsWith('hi-IN')) {
                speaker1VoiceName = selectedBrowserVoiceProfile.gender === 'female' ? 'hi-IN-Wavenet-A' : 'hi-IN-Wavenet-B';
            } else { // Default to US English
                speaker1VoiceName = selectedBrowserVoiceProfile.gender === 'female' ? 'en-US-Wavenet-F' : 'en-US-Wavenet-D';
            }
        } else {
            speaker1VoiceName = 'en-IN-Wavenet-D'; // Default fallback AI voice
        }


        // Speaker 2 is always the user, assign a contrasting standard voice.
        const speaker2VoiceName = speaker1VoiceName?.startsWith('en-IN') ? 'en-US-Standard-E' : 'en-IN-Standard-A';

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
