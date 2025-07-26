'use server';
/**
 * @fileOverview Speech synthesis flow using a local Coqui TTS engine.
 * This flow synthesizes text into a playable WAV audio Data URI by calling a command-line tool.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput } from '@/types';
import { SynthesizeSpeechInputSchema } from '@/types';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';

// Note: This flow requires the 'TTS' Python package to be installed and accessible.
// Run: pip install TTS

const synthesizeSpeechFlow = ai.defineFlow(
  {
    name: 'synthesizeSpeechFlow',
    inputSchema: SynthesizeSpeechInputSchema,
    outputSchema: z.custom<SynthesizeSpeechOutput>()
  },
  async (input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> => {
    let { textToSpeak } = input;
    
    // 1. Validate and sanitize text
    if (!textToSpeak || textToSpeak.trim().length < 5 || textToSpeak.toLowerCase().includes("undefined")) {
      console.warn("⚠️ Invalid text provided to TTS flow. Using fallback message.", { originalText: textToSpeak });
      textToSpeak = "I'm here to assist you. Could you please clarify your request?";
    }
    const sanitizedText = textToSpeak.replace(/["&\n\r]/g, "'").slice(0, 4500);

    // Define temporary file paths in a writable directory
    const tempTextPath = path.resolve('/tmp', `tts-input-${Date.now()}.txt`);
    const tempAudioPath = path.resolve('/tmp', `tts-output-${Date.now()}.wav`);

    try {
      // 2. Write the sanitized text to a temporary file
      writeFileSync(tempTextPath, sanitizedText, 'utf8');

      // 3. Spawn the coqui-tts process
      await new Promise<void>((resolve, reject) => {
        console.log(`Spawning coqui-tts for text: "${sanitizedText.substring(0, 50)}..."`);
        
        // Command and arguments for Coqui TTS
        const ttsProcess = spawn('tts', [
          '--text', sanitizedText,
          '--model_name', 'tts_models/en/ljspeech/tacotron2-DDC',
          '--vocoder_name', 'vocoder_models/en/ljspeech/hifigan_v2', // Using v2 for potentially better quality
          '--out_path', tempAudioPath
        ], { shell: true }); // Using shell:true can help with pathing issues for the CLI tool

        let stderrOutput = '';
        ttsProcess.stderr.on('data', (data) => {
          stderrOutput += data.toString();
        });

        ttsProcess.on('close', (code) => {
          if (code !== 0) {
            console.error(`❌ Coqui TTS process failed with exit code ${code}.`);
            console.error('Coqui TTS stderr:', stderrOutput);
            if (stderrOutput.toLowerCase().includes("command not found")) {
                reject(new Error("Coqui TTS command not found. Please ensure 'TTS' is installed via pip and is in your system's PATH."));
            } else {
                reject(new Error(`TTS generation failed. Exit code: ${code}. Details: ${stderrOutput}`));
            }
          } else {
            console.log('✅ Coqui TTS process completed successfully.');
            resolve();
          }
        });

        ttsProcess.on('error', (err) => {
          console.error('❌ Failed to spawn Coqui TTS process:', err);
          reject(new Error(`Failed to spawn TTS process: ${err.message}. Is Coqui TTS installed and in your PATH?`));
        });
      });

      // 4. Read the generated audio file
      const audioBuffer = readFileSync(tempAudioPath);
      const base64Wav = audioBuffer.toString('base64');
      const dataUri = `data:audio/wav;base64,${base64Wav}`;

      return {
        text: sanitizedText,
        audioDataUri: dataUri,
        voiceProfileId: "coqui-tts-default",
      };

    } catch (err: any) {
      console.error("❌ TTS generation flow failed:", err);
      return {
        text: sanitizedText,
        audioDataUri: `tts-flow-error:[${err.message}]`,
        errorMessage: err.message,
        voiceProfileId: input.voiceProfileId,
      };
    } finally {
      // 5. Clean up temporary files
      try {
        if (existsSync(tempTextPath)) unlinkSync(tempTextPath);
        if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
      } catch (cleanupError) {
        console.warn("⚠️ Failed to clean up temporary TTS files:", cleanupError);
      }
    }
  }
);

// Helper to check if a file exists before trying to delete it
function existsSync(filePath: string): boolean {
    try {
        writeFileSync(filePath, '', { flag: 'wx' }); // 'wx' flag fails if path exists
        unlinkSync(filePath);
        return false;
    } catch (e: any) {
        if (e.code === 'EEXIST') {
            return true;
        }
        return false;
    }
}


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
