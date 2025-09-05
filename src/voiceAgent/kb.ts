// src/voiceAgent/kb.ts
export const kbAdapter = {
  async retrieve({ product, selectedFileIds, max = 6 }: { product: string; selectedFileIds?: string[]; max?: number }) {
    // TODO: replace with real Firestore/Vertex/Firestore+Storage lookup
    // If selectedFileIds undefined => use all mapped files for 'product'
    return Array.from({ length: Math.min(max, 4) }).map((_, i) => ({ id: `${product}-doc-${i+1}`, text: '...' }));
  }
};
