
'use server';
/**
 * @fileOverview Speech synthesis flow using a self-hosted TTS engine (e.g., OpenTTS, Coqui TTS).
 * This flow synthesizes text into audible speech by calling a local TTS server
 * and returns a Data URI.
 * - synthesizeSpeech - Generates speech from text.
 * - SynthesizeSpeechInput - Input for the flow.
 * - SynthesizeSpeechOutput - Output from the flow, includes the audioDataUri.
 */

import { z } from 'zod';

const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(500, "Text to speak cannot exceed 500 characters."),
  voiceProfileId: z.string().optional().describe('The ID of the pre-built voice to use for synthesis (e.g., a voice name supported by the TTS engine).'),
});
export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

const SynthesizeSpeechOutputSchema = z.object({
    text: z.string().describe("The original text that was intended for speech synthesis."),
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio (e.g., 'data:audio/wav;base64,...') or an error message placeholder if synthesis failed."),
    voiceProfileId: z.string().optional().describe("The voice profile ID that was actually used for synthesis."),
    errorMessage: z.string().optional().describe("Any error message if the synthesis had an issue."),
});
export type SynthesizeSpeechOutput = z.infer<typeof SynthesizeSpeechOutputSchema>;


const SELF_HOSTED_TTS_URL = "http://localhost:5500/api/tts";

/**
 * Maps a friendly voice profile ID from the UI to a specific voice model ID
 * expected by a self-hosted Coqui/OpenTTS server.
 */
function mapVoiceProfileToTtsId(profileId?: string): string {
    const defaultVoice = 'en-us/blizzard_lessac'; // A common high-quality default
    const voiceMap: { [key: string]: string } = {
        "Salina": "en-us/ljspeech_glow-tts",
        "en-us-blizzard": "en-us/blizzard_lessac",
        "Mateo": "en-us/cmu-slt_low",
        "Leo": "en-us/cmu-rms_low"
    };
    return (profileId && voiceMap[profileId]) ? voiceMap[profileId] : defaultVoice;
}


async function synthesizeSpeechFlow(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
    const { textToSpeak, voiceProfileId } = input;
    const voiceToUse = mapVoiceProfileToTtsId(voiceProfileId);

    console.log(`🎤 Self-Hosted TTS Info: Attempting speech generation. Voice: ${voiceToUse}, Text (truncated): ${textToSpeak.substring(0, 50)}...`);

    try {
        const response = await fetch(SELF_HOSTED_TTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: textToSpeak,
                voice: voiceToUse,
                ssml: false
            })
        });

        if (!response.ok) {
            let errorBody = "Unknown error";
            try {
                errorBody = await response.text();
            } catch (e) {}
            throw new Error(`Self-hosted TTS server returned an error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

        if (!audioDataUri || !audioDataUri.startsWith("data:audio") || audioDataUri.length < 1000) {
            throw new Error("Generated audio data URI is invalid or empty.");
        }

        console.log(`✅ Self-Hosted TTS Success: Generated playable WAV audio URI. Length: ${audioDataUri.length}`);

        return {
            text: textToSpeak,
            audioDataUri: audioDataUri,
            voiceProfileId: voiceProfileId, // Return the original profile ID
        };
    } catch (error: any) {
        const errorMessage = `Self-Hosted TTS Generation FAILED. Error: ${error.message || 'Unknown error'}. Is the local TTS server running at ${SELF_HOSTED_TTS_URL} and healthy?`;
        console.error(`❌ ${errorMessage}`);
        // Instead of throwing, we return a structured error in the output object
        // The calling function will handle this and create a placeholder URI.
        return {
          text: textToSpeak,
          audioDataUri: `tts-flow-error:[${errorMessage}]`, // This will be the placeholder
          errorMessage: errorMessage,
          voiceProfileId: voiceProfileId,
        };
    }
}


export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechOutput> {
  try {
    const validatedInput = SynthesizeSpeechInputSchema.parse(input);
    
    if (!validatedInput.textToSpeak || validatedInput.textToSpeak.trim() === "") {
        throw new Error("Text to speak cannot be empty.");
    }

    return await synthesizeSpeechFlow(validatedInput);
  } catch (e: any) {
    let errorMessage = `Failed to synthesize speech: ${e.message}`;
    const errorUri = `tts-flow-error:[Error in TTS flow (Profile: ${input.voiceProfileId || 'Default'})]: ${(input.textToSpeak || "No text provided").substring(0,50)}...`;

    if (e instanceof z.ZodError) {
        errorMessage = `Input validation failed for speech synthesis: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join('; ')}`;
    }
    
    console.error("❌ synthesizeSpeech wrapper caught error:", errorMessage);
    
    return {
      text: input.textToSpeak || "Error: Text not provided or invalid input.",
      audioDataUri: errorUri, 
      errorMessage: errorMessage,
      voiceProfileId: input.voiceProfileId,
    };
  }
}
