
"use client";

// This utility makes a direct client-side request to the Google Cloud Text-to-Speech REST API.
// It requires the GOOGLE_API_KEY to be available in the client-side environment.

interface SynthesisRequest {
  text: string;
  voice: string; // The full voice name, e.g., 'en-IN-Wavenet-D'
}

interface SynthesisResponse {
  audioDataUri: string;
}

export async function synthesizeSpeechOnClient(request: SynthesisRequest): Promise<SynthesisResponse> {
  // IMPORTANT: For this to work in the browser, the key MUST be available here.
  // We will use a placeholder and rely on the user to fill it in the .env file.
  // In a production app, you would fetch this from a secure endpoint, not expose it directly.
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("TTS Error: Google API Key is not configured for the client environment.");
  }
  
  const TTS_API_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const languageCode = request.voice.startsWith('en-IN') ? 'en-IN' : 'en-US';

  const body = {
    input: {
      text: request.text,
    },
    voice: {
      languageCode: languageCode,
      name: request.voice,
    },
    audioConfig: {
      audioEncoding: 'MP3',
    },
  };

  try {
    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || `TTS API request failed with status ${response.status}`;
      console.error("TTS API Error:", errorData);
      throw new Error(`TTS Synthesis Failed: ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.audioContent) {
      throw new Error("Received an invalid response from the TTS API (missing audioContent).");
    }

    return {
      audioDataUri: `data:audio/mp3;base64,${data.audioContent}`,
    };

  } catch (error) {
    console.error("Error in synthesizeSpeechOnClient:", error);
    // Re-throw the error so the calling component can handle it
    throw error;
  }
}
