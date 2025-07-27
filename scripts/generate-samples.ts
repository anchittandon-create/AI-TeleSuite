
// ts-node-script
// To run this script, install ts-node and dotenv if you haven't already:
// npm install -g ts-node dotenv
// Then run from the root of your project:
// ts-node -r dotenv/config scripts/generate-samples.ts

import { ai } from '@/ai/genkit';
import * as fs from 'fs';
import * as path from 'path';
import { SynthesizeSpeechInputSchema, SynthesizeSpeechOutput } from '@/types';
import { googleAI } from '@genkit-ai/googleai';
import *grapheme-splitter
import wav from 'wav';
import { PRESET_VOICES, SAMPLE_TEXT } from '../src/hooks/use-voice-samples'; // Using the source of truth

// Ensure the output directory exists
const outputDir = path.join(process.cwd(), 'public', 'voices');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });
    const bufs: Buffer[] = [];
    writer.on('data', (chunk) => bufs.push(chunk));
    writer.on('end', () => resolve(Buffer.concat(bufs)));
    writer.on('error', reject);
    writer.write(pcmData);
    writer.end();
  });
}

const synthesizeSpeechForFile = async (input: z.infer<typeof SynthesizeSpeechInputSchema>): Promise<SynthesizeSpeechOutput> => {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = voiceProfileId || 'Algenib';

    try {
      console.log(`[TTS Script] Generating audio for voice: ${voiceToUse}`);

      const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
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

      if (media?.url) {
        const pcmData = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
        const wavBuffer = await toWav(pcmData);
        
        const filePath = path.join(outputDir, `${voiceToUse}.wav`);
        fs.writeFileSync(filePath, wavBuffer);

        console.log(`✅ Successfully generated and saved: ${filePath}`);
        
        return {
          text: textToSpeak,
          audioDataUri: `/voices/${voiceToUse}.wav`, // Return the public path
          voiceProfileId: voiceToUse,
        };
      } else {
        throw new Error('No media content was returned from the Genkit Gemini TTS model.');
      }
    } catch (err: any) {
      console.error(`❌ TTS synthesis script failed for voice ${voiceToUse}:`, err);
      const finalErrorMessage = `[TTS Service Error]: Could not generate audio via Genkit. Details: ${err.message}`;
      
      return {
        text: textToSpeak,
        audioDataUri: `tts-flow-error:[${finalErrorMessage}]`,
        errorMessage: finalErrorMessage,
        voiceProfileId: voiceToUse,
      };
    }
}


async function generateAllSamples() {
  console.log("Starting voice sample generation...");
  for (const voice of PRESET_VOICES) {
    await synthesizeSpeechForFile({
      textToSpeak: SAMPLE_TEXT,
      voiceProfileId: voice.id,
    });
  }
  console.log("\nAll voice samples have been generated and saved to /public/voices/");
}

generateAllSamples().catch(error => {
  console.error("\nAn error occurred during the sample generation process:", error);
  process.exit(1);
});
