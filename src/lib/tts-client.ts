"use client";

/**
 * TTS Client - Server-side synthesis via /api/tts
 * All TTS requests go through our API route with Service Account auth.
 * Includes mock fallback for development/testing.
 */

interface SynthesisRequest {
  text: string;
  voice?: string; // e.g., 'en-US-Neural2-C'
  languageCode?: string; // e.g., 'en-US'
  speakingRate?: number; // 0.25–4.0
  pitch?: number; // -20.0–20.0
  audioEncoding?: "MP3" | "LINEAR16";
}

interface SynthesisResponse {
  audioDataUri: string;
}

// Single-flight guard to prevent overlapping TTS requests
let currentSynthesisRequest: AbortController | null = null;

/**
 * Generate a mock beep sound as fallback
 */
function generateMockBeep(): string {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const duration = 0.3;
  const sampleRate = audioContext.sampleRate;
  const numSamples = duration * sampleRate;
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channel = buffer.getChannelData(0);

  // Generate a simple 440Hz sine wave (A note)
  for (let i = 0; i < numSamples; i++) {
    channel[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.3;
  }

  // Convert to WAV
  const wav = encodeWAV(buffer);
  return `data:audio/wav;base64,${arrayBufferToBase64(wav)}`;
}

function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  view.setUint16(32, buffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length, true);

  // Audio data
  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Synthesize speech via server-side /api/tts endpoint
 */
export async function synthesizeSpeechOnClient(request: SynthesisRequest): Promise<SynthesisResponse> {
  // Cancel any existing request
  if (currentSynthesisRequest) {
    console.warn("TTS request already in progress, canceling previous request...");
    currentSynthesisRequest.abort();
  }

  // Create new abort controller for this request
  const controller = new AbortController();
  currentSynthesisRequest = controller;

  try {
    // Check if mock mode is enabled
    const mockMode = process.env.NEXT_PUBLIC_MOCK_TTS === "true";
    if (mockMode) {
      console.log("TTS: Using mock beep fallback");
      await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate network delay
      return { audioDataUri: generateMockBeep() };
    }

    const response = await fetch("/api/tts", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: request.text,
        voiceName: request.voice,
        languageCode: request.languageCode,
        speakingRate: request.speakingRate,
        pitch: request.pitch,
        audioEncoding: request.audioEncoding,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `TTS API failed with status ${response.status}`;

      if (contentType?.includes("text/plain")) {
        const errorText = await response.text();
        if (errorText.startsWith("TTS_ERROR:")) {
          errorMessage = errorText.replace("TTS_ERROR:", "").trim();
        } else {
          errorMessage = errorText;
        }
      }

      // Fallback to mock on error
      console.error("TTS failed, using mock beep:", errorMessage);
      return { audioDataUri: generateMockBeep() };
    }

    // Get audio bytes from response
    const audioBlob = await response.blob();
    if (!audioBlob.size) {
      throw new Error("Received empty audio response");
    }

    // Convert blob to data URI
    const audioDataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    return { audioDataUri };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("TTS request was aborted");
      throw new Error("TTS request was canceled by a newer request");
    }

    console.error("Error in synthesizeSpeechOnClient, using mock fallback:", error);
    
    // Return mock beep as ultimate fallback
    return { audioDataUri: generateMockBeep() };
  } finally {
    // Clear the current request reference
    if (currentSynthesisRequest === controller) {
      currentSynthesisRequest = null;
    }
  }
}

/**
 * Cancel any ongoing TTS synthesis request
 */
export function cancelCurrentSynthesis() {
  if (currentSynthesisRequest) {
    console.log("Canceling current TTS synthesis request");
    currentSynthesisRequest.abort();
    currentSynthesisRequest = null;
  }
}

/**
 * Play audio from data URI with autoplay error handling
 */
export async function playAudioDataUri(
  dataUri: string,
  onEnded?: () => void,
  onError?: (error: Error) => void
): Promise<HTMLAudioElement> {
  const audio = new Audio(dataUri);
  
  if (onEnded) {
    audio.addEventListener("ended", onEnded);
  }

  if (onError) {
    audio.addEventListener("error", (e) => {
      onError(new Error(`Audio playback error: ${e.type}`));
    });
  }

  try {
    await audio.play();
  } catch (error) {
    // Handle autoplay restrictions
    console.warn("Autoplay blocked, user interaction may be required:", error);
    if (onError && error instanceof Error) {
      onError(error);
    }
  }

  return audio;
}
