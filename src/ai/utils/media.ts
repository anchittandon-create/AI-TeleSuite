"use server";

/**
 * Utilities for preparing large audio files for Gemini multimodal prompts.
 * Large inputs must be uploaded via the Gemini Files API to bypass inline size limits.
 */

const INLINE_MEDIA_SIZE_LIMIT_BYTES = 18 * 1024 * 1024; // 18MB keeps us below Gemini's inline 20MB cap.
const GEMINI_UPLOAD_ENDPOINT = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_FILES_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FILE_STATUS_TIMEOUT_MS = 45_000;
const GEMINI_FILE_STATUS_INITIAL_DELAY_MS = 600;
const GEMINI_FILE_STATUS_MAX_DELAY_MS = 2_500;

interface ParsedDataUri {
  mimeType: string;
  base64Data: string;
  sizeInBytes: number;
}

export interface GeminiMediaReference {
  url: string;
  contentType?: string;
}

/**
 * Parse a Base64 data URI and return metadata + plain Base64 payload.
 */
function parseDataUri(dataUri: string): ParsedDataUri {
  const match = dataUri.match(/^data:(?<mime>.+?);base64,(?<data>.+)$/);
  if (!match?.groups?.mime || !match?.groups?.data) {
    throw new Error("Invalid audio data URI provided.");
  }

  const base64Data = match.groups.data;
  const mimeType = match.groups.mime;

  // Base64 length -> bytes: (len * 3) / 4 minus padding.
  const padding = (base64Data.endsWith("==") ? 2 : base64Data.endsWith("=") ? 1 : 0);
  const sizeInBytes = Math.floor(base64Data.length * 0.75) - padding;

  return { mimeType, base64Data, sizeInBytes };
}

async function uploadToGeminiFiles(
  base64Data: string,
  mimeType: string,
  displayName?: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Cannot upload large audio: GOOGLE_API_KEY is not configured.");
  }

  const buffer = Buffer.from(base64Data, "base64");
  const endpoint = `${GEMINI_UPLOAD_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "X-Goog-Upload-File-Name": displayName ?? `call-audio-${Date.now()}`,
    "X-Goog-Upload-Protocol": "raw",
    "Content-Length": buffer.byteLength.toString(),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: buffer,
    cache: "no-store",
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini file upload failed (${response.status}): ${responseText}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(`Gemini file upload returned non-JSON payload: ${responseText}`);
  }

  const filePayload =
    parsed?.file ||
    parsed?.files?.[0] ||
    parsed;

  const fileName: string | undefined =
    parsed?.name ||
    parsed?.resourceName ||
    filePayload?.name ||
    filePayload?.resourceName;

  let fileUri: string | undefined =
    parsed?.fileUri ||
    parsed?.uri ||
    filePayload?.fileUri ||
    filePayload?.uri;

  if (!fileUri && fileName) {
    const sanitized = fileName.startsWith('/') ? fileName.slice(1) : fileName;
    fileUri = `${GEMINI_FILES_BASE_URL}/${sanitized}`;
  }

  if (!fileUri) {
    const keys = Object.keys(parsed ?? {});
    throw new Error(
      `Gemini file upload succeeded but no file URI was returned. Response keys: [${keys.join(
        ', '
      )}]`
    );
  }

  await waitForGeminiFileActivation({
    fileUri,
    apiKey,
    fallbackFileName: fileName,
  });

  return fileUri;
}

/**
 * Ensure the provided audio is referenced in a way Gemini can consume.
 * Inline small files, upload larger ones automatically.
 */
export async function resolveGeminiAudioReference(
  audioUrlOrDataUri: string,
  options?: { inlineSizeLimitBytes?: number; displayName?: string }
): Promise<GeminiMediaReference> {
  if (!audioUrlOrDataUri) {
    throw new Error("Audio input is required for transcription or scoring.");
  }

  // Already a remote Gemini file or external URL.
  if (audioUrlOrDataUri.startsWith("http://") || audioUrlOrDataUri.startsWith("https://")) {
    return { url: audioUrlOrDataUri };
  }

  if (!audioUrlOrDataUri.startsWith("data:")) {
    throw new Error("Unsupported audio input format. Provide a data URI or Gemini file URL.");
  }

  const targetLimit = options?.inlineSizeLimitBytes ?? INLINE_MEDIA_SIZE_LIMIT_BYTES;
  const { base64Data, mimeType, sizeInBytes } = parseDataUri(audioUrlOrDataUri);

  if (sizeInBytes <= targetLimit) {
    return { url: audioUrlOrDataUri, contentType: mimeType };
  }

  const fileUri = await uploadToGeminiFiles(base64Data, mimeType, options?.displayName);
  return { url: fileUri, contentType: mimeType };
}

async function waitForGeminiFileActivation(params: {
  fileUri: string;
  apiKey: string;
  fallbackFileName?: string;
}): Promise<void> {
  const { fileUri, apiKey, fallbackFileName } = params;
  const deadline = Date.now() + GEMINI_FILE_STATUS_TIMEOUT_MS;
  let delayMs = GEMINI_FILE_STATUS_INITIAL_DELAY_MS;
  let lastState: string | undefined;
  let lastPayload: any;

  const buildStatusUrl = () => {
    try {
      const url = new URL(fileUri.startsWith("http") ? fileUri : `${GEMINI_FILES_BASE_URL}/${fileUri.replace(/^\/?/, "")}`);
      url.searchParams.set("key", apiKey);
      return url.toString();
    } catch {
      const sanitized = fileUri.startsWith("/") ? fileUri.slice(1) : fileUri;
      const candidate = sanitized.startsWith("files/")
        ? sanitized
        : `files/${sanitized}`;
      const url = new URL(`${GEMINI_FILES_BASE_URL}/${candidate}`);
      url.searchParams.set("key", apiKey);
      return url.toString();
    }
  };

  const statusUrl = buildStatusUrl();

  while (Date.now() < deadline) {
    const response = await fetch(statusUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `Gemini file status poll failed (${response.status}): ${responseText}`
      );
    }

    let parsed: any;
    try {
      parsed = responseText ? JSON.parse(responseText) : undefined;
    } catch {
      throw new Error(
        `Gemini file status poll returned non-JSON payload: ${responseText}`
      );
    }

    const filePayload =
      parsed?.file ||
      parsed?.files?.[0] ||
      parsed;

    const state: string | undefined =
      parsed?.state ||
      filePayload?.state;

    lastState = state;
    lastPayload = filePayload ?? parsed;

    if (state === "ACTIVE") {
      return;
    }

    if (state === "FAILED") {
      const name =
        parsed?.name ||
        filePayload?.name ||
        fallbackFileName ||
        "unknown";
      throw new Error(
        `Gemini file processing failed for ${name}. Details: ${JSON.stringify(lastPayload)}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 1.5, GEMINI_FILE_STATUS_MAX_DELAY_MS);
  }

  const descriptiveState = lastState ?? "UNKNOWN";
  throw new Error(
    `Gemini file did not become ACTIVE within ${GEMINI_FILE_STATUS_TIMEOUT_MS}ms. Last observed state: ${descriptiveState}. Payload: ${JSON.stringify(
      lastPayload
    )}`
  );
}
