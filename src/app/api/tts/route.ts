/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

type TtsPayload = {
  text: string;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number; // 0.25–4.0
  pitch?: number;        // -20.0–20.0
  audioEncoding?: "MP3" | "LINEAR16";
};

function getClient() {
  const sa = process.env.GOOGLE_TTS_SA_JSON;
  if (!sa) throw new Error("Missing GOOGLE_TTS_SA_JSON");
  const credentials = JSON.parse(sa);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TtsPayload;
    const text = (body.text || "").trim();
    if (!text) return new Response("Missing text", { status: 400 });

    // Extract language code from voice name if not provided
    // Voice names are in format: "en-IN-Wavenet-A" or "en-US-Neural2-C"
    let languageCode = body.languageCode;
    let voiceName = body.voiceName || process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-C";
    
    if (!languageCode && voiceName) {
      // Extract language code from voice name (e.g., "en-IN-Wavenet-A" -> "en-IN")
      const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
      if (match) {
        languageCode = match[1];
      }
    }
    
    // Fallback to environment variable or default
    if (!languageCode) {
      languageCode = process.env.GOOGLE_TTS_LANG || "en-US";
    }
    
    const audioEncoding = (body.audioEncoding || (process.env.GOOGLE_TTS_ENCODING as any) || "MP3") as "MP3" | "LINEAR16";

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

    const data =
      resp.audioContent instanceof Uint8Array
        ? Buffer.from(resp.audioContent)
        : Buffer.from(String(resp.audioContent ?? ""), "base64");

    if (!data.length) return new Response("Empty audio", { status: 502 });

    const type = audioEncoding === "LINEAR16" ? "audio/wav" : "audio/mpeg";
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store, max-age=0",
        "X-TTS-Provider": "gcloud",
      },
    });
  } catch (err: any) {
    // Surface Google error details for debugging
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
    if (!sa) {
      return Response.json(
        {
          status: "error",
          message: "Missing GOOGLE_TTS_SA_JSON environment variable",
        },
        { status: 500 }
      );
    }

    // Validate JSON parsing
    try {
      JSON.parse(sa);
    } catch {
      return Response.json(
        {
          status: "error",
          message: "Invalid GOOGLE_TTS_SA_JSON format",
        },
        { status: 500 }
      );
    }

    return Response.json({
      status: "healthy",
      mode: "gcloud",
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
