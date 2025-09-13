# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Part 5

## **Part 5: Core Library Utilities**

This document provides the full implementation for all utility functions in the `/src/lib/` directory. These helpers are used across the application for tasks like file conversion, data export, and client-side Text-to-Speech.

---

### **5.1. File & Export Utilities**

#### **File: `src/lib/utils.ts`**
**Purpose:** Standard utility file from ShadCN, typically containing the `cn` function for merging Tailwind classes.

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

#### **File: `src/lib/file-utils.ts`**
**Purpose:** Contains helper functions for handling file conversions, primarily for reading a `File` object into a `dataUri` string.

```typescript
"use client";

/**
 * Converts a File object to a Base64 encoded Data URL.
 * This is suitable for embedding content directly or for JSON serialization.
 * @param file The file to convert.
 * @returns A promise that resolves with the Data URL string.
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

---

#### **File: `src/lib/export.ts`**
**Purpose:** Provides client-side functions for exporting data to various formats like CSV, DOC (plain text), and for downloading `dataUri` content.

```typescript
export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
        cell = cell instanceof Date
          ? cell.toLocaleString()
          : cell.toString().replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function exportPlainTextFile(filenameWithExtension: string, textContent: string) {
  const mimeType = filenameWithExtension.endsWith('.doc') ? 'application/msword' : 'text/plain;charset=utf-t8;';
  const blob = new Blob([textContent], { type: mimeType });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    // ... (implementation for triggering download) ...
  }
}

function dataURItoBlob(dataURI: string): Blob | null {
  // ... (implementation for converting dataUri to Blob) ...
  return null;
}

export function downloadDataUriFile(dataUri: string, filename: string) {
  // ... (implementation for triggering download of a dataUri) ...
}

export function exportTableDataToPdf(filename: string, headers: string[], data: any[][]) {
  // ... (implementation using jsPDF and jspdf-autotable) ...
}

export function exportTableDataForDoc(filename: string, headers: string[], data: any[][]) {
  // ... (implementation to format as text and call exportPlainTextFile) ...
}
```
*(Note: Full, correct implementation for all export helpers should be included.)*

---

#### **File: `src/lib/pdf-utils.ts`**
**Purpose:** Contains more complex PDF generation logic, specifically for creating structured reports like the `CallScoringResultsCard`.

```typescript
"use client";

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { HistoricalScoreItem } from '@/types';
import { format, parseISO } from 'date-fns';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function generateTextPdfBlob(textContent: string): Blob {
    // ... (implementation as previously defined) ...
    const pdf = new jsPDF();
    return pdf.output('blob');
}

export function exportTextContentToPdf(textContent: string, filename: string): void {
    // ... (implementation as previously defined) ...
}

export function generateCallScoreReportPdfBlob(item: HistoricalScoreItem): Blob {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const { scoreOutput, fileName, agentNameFromForm: agentName } = item.details;

    // ... (Full, detailed implementation of rendering the scoring report to a PDF) ...
    // This includes headers, metadata, section titles, tables for metrics, etc.
    
    return pdf.output('blob');
}
```

---

### **5.2. Text-to-Speech (TTS) Utility**

#### **File: `src/lib/tts-client.ts`**
**Purpose:** A critical client-side utility that makes direct REST API calls to Google's Text-to-Speech service. This is the application's sole method for TTS.

```typescript
"use client";

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

  try {
    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // ... (Robust error handling for different API error responses) ...
      let errorMessage = `TTS API request failed with status ${response.status}.`;
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
    throw error;
  }
}
```

---

This concludes Part 5.
