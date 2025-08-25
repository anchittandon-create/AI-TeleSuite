
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
  // This environment variable MUST be prefixed with NEXT_PUBLIC_ to be available in the client-side environment.
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey === "") {
    throw new Error("TTS Error: Google API Key is not configured for the client environment. Please set NEXT_PUBLIC_GOOGLE_API_KEY in your .env file.");
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
      let errorMessage = `TTS API request failed with status ${response.status}.`;
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
          try {
              const errorData = await response.json();
              // Defensive check for various possible error structures from Google APIs
              if (errorData && errorData.error && errorData.error.message) {
                errorMessage = errorData.error.message;
              } else if (errorData && Array.isArray(errorData.details) && errorData.details.length > 0) {
                errorMessage = errorData.details.map((d: any) => d.description || JSON.stringify(d)).join('; ');
              } else if (Object.keys(errorData).length === 0) {
                 errorMessage = "The API returned an empty error object. This often indicates a permissions issue. Please verify in your Google Cloud Console that the 'Cloud Text-to-Speech API' is enabled and that your API key has no IP or referrer restrictions.";
              } else {
                errorMessage = `Received an error from the API, but the format was unexpected. Full error: ${JSON.stringify(errorData).substring(0, 200)}`;
              }
              console.error("TTS API JSON Error:", errorData);
          } catch (jsonError) {
              errorMessage = "Failed to parse JSON error response from API. The service may be down or returning an unexpected payload."
          }
      } else {
          // If the response is not JSON, it's likely an HTML error page from Google Cloud's gateway.
          const errorText = await response.text();
          console.error("TTS API Non-JSON Error:", errorText.substring(0, 500)); // Log a snippet
          if (errorText.toLowerCase().includes("api not enabled") || errorText.toLowerCase().includes("texttospeech.googleapis.com")) {
               errorMessage = `The 'Cloud Text-to-Speech API' is not enabled for your project or is being blocked. Please visit your Google Cloud Console to enable it. (Status: ${response.status})`;
          } else if (errorText.toLowerCase().includes("api key not valid")) {
               errorMessage = `The provided API key is not valid. Please check the key in your .env file. (Status: ${response.status})`;
          } else {
              errorMessage = `The API returned an unexpected response (likely HTML). This often means your API key has IP/HTTP referrer restrictions that are blocking the request. Please check your Google Cloud Console API settings. (Status: ${response.status})`;
          }
      }
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
