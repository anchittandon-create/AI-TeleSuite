# Replication Prompt: Part 5 - Core Library Utilities

This document covers the utility functions located in the `/src/lib/` directory, which provide shared functionality across the application.

---

### **1. `utils.ts`**

The standard utility file provided by ShadCN for class name merging.

#### **File: `src/lib/utils.ts`**
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
**Purpose:** A helper function to conditionally join CSS class names, primarily for use with Tailwind CSS.

---

### **2. `file-utils.ts`**

Utilities for handling file conversions.

#### **File: `src/lib/file-utils.ts`**
```typescript
"use client";

/**
 * Converts a File object to a Base64 encoded Data URL.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URL.'));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}
```
**Purpose:** Provides a way to convert a `File` object into a `data:` URI string, which is necessary for sending file content to AI flows.

---

### **3. `tts-client.ts`**

The client-side Text-to-Speech utility.

#### **File: `src/lib/tts-client.ts`**
```typescript
"use client";

// This utility makes a direct client-side request to the Google Cloud Text-to-Speech REST API.

interface SynthesisRequest {
  text: string;
  voice: string; // e.g., 'en-IN-Wavenet-D'
}

interface SynthesisResponse {
  audioDataUri: string;
}

export async function synthesizeSpeechOnClient(request: SynthesisRequest): Promise<SynthesisResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey === "") {
    throw new Error("TTS Error: Google API Key is not configured for the client environment. Please set NEXT_PUBLIC_GOOGLE_API_KEY in your .env file.");
  }
  
  const TTS_API_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const languageCode = request.voice.split('-')[0] + '-' + request.voice.split('-')[1];

  const body = {
    input: { text: request.text },
    voice: { languageCode: languageCode, name: request.voice },
    audioConfig: { audioEncoding: 'MP3' },
  };

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // ... (full error handling logic as in the source file)
  }

  const data = await response.json();

  if (!data.audioContent) {
    throw new Error("Received an invalid response from the TTS API (missing audioContent).");
  }

  return {
    audioDataUri: `data:audio/mp3;base64,${data.audioContent}`,
  };
}
```
**Purpose:** Implements the application's Text-to-Speech functionality by making a direct, client-side API call to Google Cloud's TTS service. This is a critical component for the voice agents.

---

### **4. `export.ts`**

Functions for exporting data to various file formats.

#### **File: `src/lib/export.ts`**
```typescript
// ... (full implementation of exportToCsv, exportPlainTextFile, downloadDataUriFile, exportTableDataForDoc, and exportTableDataToPdf)
```
**Purpose:** A collection of client-side helper functions for creating and downloading files (CSV, plain text/DOC, PDF tables) from data, used across all dashboard pages.

---

### **5. `pdf-utils.ts`**

Utilities specifically for generating PDF documents.

#### **File: `src/lib/pdf-utils.ts`**
```typescript
"use client";

import jsPDF from 'jspdf';
import 'jspdf-autotable';
// ... (rest of the imports)

// ... (implementation of generateTextPdfBlob, exportTextContentToPdf, and generateCallScoreReportPdfBlob)
```
**Purpose:** Contains specialized functions for creating PDF documents using the `jsPDF` and `jspdf-autotable` libraries. It is used for exporting call scoring reports and other text-based content.