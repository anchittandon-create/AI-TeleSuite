/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import textToSpeech from "@google-cloud/text-to-speech";

type TtsPayload = {
  text: string;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number; // 0.25–4.0
  pitch?: number;        // -20.0–20.0
  audioEncoding?: "MP3" | "LINEAR16";
};

// Check if we should use REST API (with API key) or gRPC (with service account)
function shouldUseRestApi(): boolean {
  const sa = process.env.GOOGLE_TTS_SA_JSON;
  const apiKey = process.env.GOOGLE_API_KEY;
  
  // If we have service account, prefer it (more secure)
  if (sa) {
    try {
      JSON.parse(sa);
      return false; // Use gRPC with service account
    } catch {
      // Invalid service account JSON, fall through to API key
    }
  }
  
  // Use REST API if we have an API key
  return !!apiKey;
}

function getClient() {
  const sa = process.env.GOOGLE_TTS_SA_JSON;
  if (!sa) throw new Error("Missing GOOGLE_TTS_SA_JSON");
  const credentials = JSON.parse(sa);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

// REST API endpoint for API key authentication
async function synthesizeWithRestApi(payload: TtsPayload): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY for REST API");
  }

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text: payload.text },
      voice: {
        languageCode: payload.languageCode,
        name: payload.voiceName,
      },
      audioConfig: {
        audioEncoding: payload.audioEncoding || "MP3",
        speakingRate: payload.speakingRate ?? 1.0,
        pitch: payload.pitch ?? 0,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google TTS API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("No audio content in response");
  }

  // Google returns base64-encoded audio
  return Buffer.from(data.audioContent, "base64");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TtsPayload;
    const text = (body.text || "").trim();
    if (!text) return new Response("Missing text", { status: 400 });

    // Extract language code from voice name if not provided
    let languageCode = body.languageCode;
    const voiceName = body.voiceName || process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-C";
    if (!languageCode && voiceName) {
      const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
      if (match) {
        languageCode = match[1];
      }
    }
    if (!languageCode) {
      languageCode = process.env.GOOGLE_TTS_LANG || "en-US";
    }
    const audioEncoding = (body.audioEncoding || (process.env.GOOGLE_TTS_ENCODING as any) || "MP3") as "MP3" | "LINEAR16";

    let data: Buffer;
    if (shouldUseRestApi()) {
      data = await synthesizeWithRestApi({
        text,
        languageCode,
        voiceName,
        speakingRate: body.speakingRate ?? 1.0,
        pitch: body.pitch ?? 0,
        audioEncoding,
      });
    } else {
      const client = getClient();
      const [resp] = await client.synthesizeSpeech({
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: {
          audioEncoding,
          speakingRate: body.speakingRate ?? 1.0,
          pitch: body.pitch ?? 0,
        },
      });
      data =
        resp.audioContent instanceof Uint8Array
          ? Buffer.from(resp.audioContent)
          : Buffer.from(String(resp.audioContent ?? ""), "base64");
    }

    // After successful synthesis, update quota usage
    // Use moderate cost quota for TTS
    const ttsRateLimitConfig = {
      identifier: 'tts',
      maxRequests: (typeof RATE_LIMITS.MODERATE.maxRequests === 'number' ? RATE_LIMITS.MODERATE.maxRequests : 20),
      windowMs: RATE_LIMITS.MODERATE.windowMs,
    };
    const rateLimitCheck = rateLimiter.check(ttsRateLimitConfig);
    if (!rateLimitCheck.allowed) {
      // Quota exceeded, but allow this request to complete and block future requests
      console.warn('⚠️ Rate limit exceeded for TTS (post-execution)');
      // Optionally, log or notify admin here
    }
    // Always increment usage for this completed request
    rateLimiter.incrementOnly(ttsRateLimitConfig);

    if (!data.length) return new Response("Empty audio", { status: 502 });

    const type = audioEncoding === "LINEAR16" ? "audio/wav" : "audio/mpeg";
    // Use .arrayBuffer() for Response body
  return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store, max-age=0",
        "X-TTS-Provider": "gcloud",
        "X-TTS-Auth-Method": shouldUseRestApi() ? "api-key" : "service-account",
      },
    });
  } catch (err: any) {
    const msg = (err?.message || "TTS failed").slice(0, 500);
    return new Response(`TTS_ERROR: ${msg}`, { status: 500 });
  }
}

export async function GET() {
  try {
    const mockMode = process.env.MOCK_TTS === "true";
    if (mockMode) {
      return Response.json({
        status: "healthy",
        mode: "mock",
        message: "TTS running in mock mode (beep fallback)",
      });
    }

    const sa = process.env.GOOGLE_TTS_SA_JSON;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!sa && !apiKey) {
      return Response.json(
        {
          status: "error",
          message: "Missing both GOOGLE_TTS_SA_JSON and GOOGLE_API_KEY environment variables",
        },
        { status: 500 }
      );
    }

    // Validate service account JSON if provided
    let authMode = "api-key";
    if (sa) {
      try {
        JSON.parse(sa);
        authMode = "service-account";
      } catch {
        return Response.json(
          {
            status: "error",
            message: "Invalid GOOGLE_TTS_SA_JSON format",
          },
          { status: 500 }
        );
      }
    }

    return Response.json({
      status: "healthy",
      mode: "gcloud",
      authMode,
      languageCode: process.env.GOOGLE_TTS_LANG || "en-US",
      voiceName: process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-C",
      audioEncoding: process.env.GOOGLE_TTS_ENCODING || "MP3",
    });
  } catch (err: any) {
    return Response.json(
      {
        status: "error",
        message: err?.message || "Health check failed",
      },
      { status: 500 }
    );
  }
}
