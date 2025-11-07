/**
 * Utilities for preparing large audio files for Gemini multimodal prompts.
 * Large inputs must be uploaded via the Gemini Files API to bypass inline size limits.
 */

const INLINE_MEDIA_SIZE_LIMIT_BYTES = 18 * 1024 * 1024; // 18MB keeps us below Gemini's inline 20MB cap.
const GEMINI_UPLOAD_ENDPOINT = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_FILES_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FILE_STATUS_TIMEOUT_MS = 120_000; // Reduced timeout for cost savings (2 minutes)
const GEMINI_FILE_STATUS_INITIAL_DELAY_MS = 1000; // Slightly longer initial delay
const GEMINI_FILE_STATUS_MAX_DELAY_MS = 3_000; // Allow longer delays

// Supported audio MIME types for Gemini multimodal models
const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',      // MP3
  'audio/mp4',       // M4A, MP4
  'audio/wav',       // WAV
  'audio/webm',      // WEBM
  'audio/flac',      // FLAC
  'audio/ogg',       // OGG
  'audio/aac',       // AAC
  'audio/m4a',       // M4A
  'audio/x-m4a',     // M4A variant
  'audio/mp3',       // MP3 variant
  'audio/x-wav',     // WAV variant
  'audio/3gpp',      // 3GPP
  'audio/3gpp2',     // 3GPP2
  'audio/amr',       // AMR
  'audio/opus',      // OPUS
]);

interface ParsedDataUri {
  mimeType: string;
  base64Data: string;
  sizeInBytes: number;
}

export interface GeminiMediaReference {
  url: string;
  contentType?: string;
}

type JsonRecord = Record<string, unknown>;

const toRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : undefined;

const getStringValue = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const pickFilePayload = (parsed?: JsonRecord): JsonRecord | undefined => {
  if (!parsed) {
    return undefined;
  }
  const directFile = toRecord(parsed.file);
  if (directFile) {
    return directFile;
  }
  const filesValue = parsed.files;
  if (Array.isArray(filesValue)) {
    for (const entry of filesValue) {
      const record = toRecord(entry);
      if (record) {
        return record;
      }
    }
  }
  return parsed;
};

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

  console.log(`Parsing data URI with MIME type: ${mimeType}`);

  // Validate supported audio format
  if (!SUPPORTED_AUDIO_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`Unsupported audio format: ${mimeType}. Supported formats include MP3, M4A, MP4, WAV, WEBM, FLAC, OGG, AAC, AMR, OPUS, 3GPP.`);
  }

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
  const fileSize = buffer.byteLength;

  // Use resumable upload for larger files to support up to 2GB
  const endpoint = `${GEMINI_UPLOAD_ENDPOINT}?uploadType=resumable&key=${encodeURIComponent(apiKey)}`;

  // Step 1: Initiate resumable upload
  const initHeaders: Record<string, string> = {
    "Content-Type": mimeType,
    "X-Goog-Upload-File-Name": displayName ?? `call-audio-${Date.now()}`,
    "X-Goog-Upload-Protocol": "resumable",
    "X-Goog-Upload-Command": "start",
    "Content-Length": "0", // No body for initiation
  };

  const initResponse = await fetch(endpoint, {
    method: "POST",
    headers: initHeaders,
    cache: "no-store",
  });

  const initResponseText = await initResponse.text();
  if (!initResponse.ok) {
    throw new Error(`Gemini resumable upload initiation failed (${initResponse.status}): ${initResponseText}`);
  }

  const uploadUrl = initResponse.headers.get("Location") || initResponse.headers.get("location");
  if (!uploadUrl) {
    throw new Error("Gemini resumable upload initiation did not return an upload URL.");
  }

  // Step 2: Upload the file data
  const uploadHeaders: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
    "Content-Length": fileSize.toString(),
  };

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: uploadHeaders,
    body: buffer,
    cache: "no-store",
  });

  const uploadResponseText = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw new Error(`Gemini file upload failed (${uploadResponse.status}): ${uploadResponseText}`);
  }

  let parsed: JsonRecord = {};
  try {
    const raw: unknown = JSON.parse(uploadResponseText);
    parsed = toRecord(raw) ?? {};
  } catch {
    throw new Error(`Gemini file upload returned non-JSON payload: ${uploadResponseText}`);
  }

  const filePayload = pickFilePayload(parsed);

  const fileName =
    getStringValue(parsed.name) ||
    getStringValue(parsed.resourceName) ||
    getStringValue(filePayload?.name) ||
    getStringValue(filePayload?.resourceName);

  let fileUri =
    getStringValue(parsed.fileUri) ||
    getStringValue(parsed.uri) ||
    getStringValue(filePayload?.fileUri) ||
    getStringValue(filePayload?.uri);

  if (!fileUri && fileName) {
    const sanitized = fileName.startsWith('/') ? fileName.slice(1) : fileName;
    fileUri = `${GEMINI_FILES_BASE_URL}/${sanitized}`;
  }

  if (!fileUri) {
    const keys = Object.keys(parsed);
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
 * 
 * Supported audio formats: MP3, M4A, MP4, WAV, WEBM, FLAC, OGG, AAC, AMR, OPUS, 3GPP.
 * For data URIs, the MIME type must match one of the supported formats.
 * For URLs, ensure the linked file is in a supported format.
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
  let lastPayload: JsonRecord | undefined;

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

    let parsed: JsonRecord | undefined;
    try {
      parsed = responseText ? toRecord(JSON.parse(responseText)) : undefined;
    } catch {
      throw new Error(
        `Gemini file status poll returned non-JSON payload: ${responseText}`
      );
    }

    const filePayload = pickFilePayload(parsed);

    const state =
      getStringValue(parsed?.state) ||
      getStringValue(filePayload?.state);

    lastState = state;
    lastPayload = filePayload ?? parsed;

    if (state === "ACTIVE") {
      return;
    }

    if (state === "FAILED") {
      const name =
        getStringValue(parsed?.name) ||
        getStringValue(filePayload?.name) ||
        fallbackFileName ||
        "unknown";
      throw new Error(
        `Gemini file processing failed for ${name}. Details: ${JSON.stringify(lastPayload ?? {})}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 1.5, GEMINI_FILE_STATUS_MAX_DELAY_MS);
  }

  const descriptiveState = lastState ?? "UNKNOWN";
  throw new Error(
    `Gemini file did not become ACTIVE within ${GEMINI_FILE_STATUS_TIMEOUT_MS}ms. Last observed state: ${descriptiveState}. Payload: ${JSON.stringify(
      lastPayload ?? {}
    )}`
  );
}
