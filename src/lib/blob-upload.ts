"use client";

import { upload } from "@vercel/blob/client";

const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024; // 8MB

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export async function uploadAudioFile(
  file: File,
  options?: { onProgress?: (percentage: number) => void }
): Promise<{ url: string; pathname: string }> {
  const safeName = sanitizeFileName(file.name || "audio-file");
  const timestamp = Date.now();
  const pathname = `audio/${timestamp}-${safeName || "call"}`;

  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: file.type || "application/octet-stream",
    multipart: file.size > MULTIPART_THRESHOLD_BYTES,
    onUploadProgress: options?.onProgress,
  });

  return { url: result.url, pathname: result.pathname ?? pathname };
}
