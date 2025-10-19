"use server";

import { NextRequest, NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import type { HandleUploadBody } from "@vercel/blob";
import { MAX_AUDIO_FILE_SIZE_BYTES } from "@/config/media";

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
 "audio/flac",
  "audio/*",
];

export async function POST(request: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch (error) {
    console.error("Blob upload route received invalid JSON payload:", error);
    return NextResponse.json(
      { error: "Invalid upload payload" },
      { status: 400 }
    );
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_AUDIO_FILE_SIZE_BYTES,
        allowedContentTypes: ALLOWED_AUDIO_CONTENT_TYPES,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Blob upload route failed while handling request:", error);
    return NextResponse.json(
      { error: "Failed to generate upload token" },
      { status: 500 }
    );
  }
}
