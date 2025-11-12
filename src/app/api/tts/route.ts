export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

type TtsPayload = {
  text: string;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number; // 0.25–4.0
  pitch?: number;        // -20.0–20.0
  audioEncoding?: "MP3" | "LINEAR16";
};

// Edge TTS voices mapping
const EDGE_VOICES = {
  'en-US': 'en-US-AriaNeural',
  'en-GB': 'en-GB-SoniaNeural',
  'en-IN': 'en-IN-NeerjaNeural',
  'hi-IN': 'hi-IN-MadhurNeural',
  'es-ES': 'es-ES-ElviraNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'it-IT': 'it-IT-ElsaNeural',
  'pt-BR': 'pt-BR-FranciscaNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'ar-SA': 'ar-SA-ZariyahNeural',
  'ru-RU': 'ru-RU-SvetlanaNeural',
};

async function synthesizeWithEdgeTTS(payload: TtsPayload): Promise<Buffer> {
  const text = payload.text;
  const languageCode = payload.languageCode || 'en-US';
  const voiceName = payload.voiceName || EDGE_VOICES[languageCode as keyof typeof EDGE_VOICES] || EDGE_VOICES['en-US'];
  const rate = payload.speakingRate ? `+${Math.round((payload.speakingRate - 1) * 100)}%` : '+0%';
  const pitch = payload.pitch ? `+${payload.pitch}Hz` : '+0Hz';

  // Create temporary file
  const tempDir = os.tmpdir();
  const outputFile = path.join(tempDir, `tts-${Date.now()}.mp3`);

  try {
    // Use edge-tts command line tool
    const command = `edge-tts --voice "${voiceName}" --text "${text.replace(/"/g, '\\"')}" --write-media "${outputFile}" --rate "${rate}" --pitch "${pitch}"`;

    console.log('Running Edge TTS command:', command.replace(/--text "[^"]*"/, '--text "[REDACTED]"'));

    await execAsync(command);

    // Read the generated file
    const audioBuffer = fs.readFileSync(outputFile);

    // Clean up temp file
    fs.unlinkSync(outputFile);

    return audioBuffer;
  } catch (error) {
    console.error('Edge TTS error:', error);
    throw new Error(`Edge TTS synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TtsPayload;
    const text = (body.text || "").trim();
    if (!text) return new Response("Missing text", { status: 400 });

    // Extract language code from voice name if not provided
    let languageCode = body.languageCode;
    const voiceName = body.voiceName || EDGE_VOICES['en-US'];
    if (!languageCode && voiceName) {
      // Try to extract language from voice name
      const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
      if (match) {
        languageCode = match[1];
      }
    }
    if (!languageCode) {
      languageCode = "en-US";
    }
    const audioEncoding = body.audioEncoding || "MP3";

    // Use Edge TTS
    const data = await synthesizeWithEdgeTTS({
      text,
      languageCode,
      voiceName,
      speakingRate: body.speakingRate ?? 1.0,
      pitch: body.pitch ?? 0,
      audioEncoding,
    });

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
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store, max-age=0",
        "X-TTS-Provider": "edge-tts",
        "X-TTS-Auth-Method": "free",
      },
    });
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : "TTS failed").slice(0, 500);
    return new Response(`TTS_ERROR: ${msg}`, { status: 500 });
  }
}

export function GET() {
  try {
    return Response.json({
      status: "healthy",
      mode: "edge-tts",
      authMode: "free",
      languageCode: "en-US",
      voiceName: EDGE_VOICES['en-US'],
      audioEncoding: "MP3",
      supportedLanguages: Object.keys(EDGE_VOICES),
      costOptimization: {
        usingFreeService: true,
        estimatedMonthlyCost: '$0 (free Edge TTS)',
      },
    });
  } catch (err: unknown) {
    return Response.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Health check failed",
      },
      { status: 500 }
    );
  }
}
