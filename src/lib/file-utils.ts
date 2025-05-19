
"use client";

/**
 * Converts a File object to a Base64 encoded Data URL.
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
