
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { CUSTOMER_COHORTS } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';
import { fileToDataUrl } from '@/lib/file-utils';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v4_with_content';

const inferCategoryFromName = (name: string, type: string): string => {
    const lowerName = name.toLowerCase();
    const lowerType = type.toLowerCase();
    
    if (lowerName.includes('pricing') || lowerName.includes('price')) {
        if (lowerType.includes('excel') || lowerType.includes('spreadsheet')) {
            return 'Pricing';
        }
    }
    if (lowerName.includes('product') && (lowerName.includes('desc') || lowerName.includes('detail'))) {
        return 'Product Description';
    }
    if (lowerName.includes('rebuttal')) {
        return 'Rebuttals';
    }
    if (lowerName.includes('pitch') || lowerName.includes('script')) {
        return 'Pitch';
    }
    return 'General';
};

// Helper function to create a downloadable data URI for plain text
const textToDataUrl = (text: string): string => {
  const blob = new Blob([text], { type: 'text/plain' });
  return URL.createObjectURL(blob); // Note: this creates a temporary URL
}

export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  // Effect to migrate old data if necessary, ensuring downloadable content where possible
  useEffect(() => {
    if (files && files.length > 0) {
      let needsUpdate = false;
      const updatedFiles = files.map(file => {
        let newFile = { ...file };
        
        // Migrate persona
        if (file.persona === 'N/A' || file.persona === null || file.persona === undefined) {
          needsUpdate = true;
          newFile.persona = 'Universal' as CustomerCohort;
        }

        // Add category if it doesn't exist
        if (file.category === undefined) {
          needsUpdate = true;
          newFile.category = inferCategoryFromName(file.name, file.type);
        }

        // BACKFILL DATA URI for existing text entries to make them downloadable
        if (file.isTextEntry && file.textContent && !file.dataUri) {
          try {
             // For text entries, we can create a blob and a downloadable URL.
            const textBlob = new Blob([file.textContent], {type : 'text/plain'});
            // This is a quick operation, so we can do it directly.
            // Note: This creates a temporary object URL. For a permanent data URI, we'd need base64 encoding,
            // but this is sufficient for immediate download functionality and avoids large base64 strings in localStorage.
            newFile.dataUri = URL.createObjectURL(textBlob);
            needsUpdate = true;
          } catch(e) {
            console.error("Could not create data URI for existing text entry:", e);
          }
        }

        return newFile;
      });

      if (needsUpdate) {
        setFiles(updatedFiles);
      }
    }
    // We only want to run this migration logic once on component mount when files are loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const addFile = useCallback((fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>): KnowledgeFile => {
    const newEntry: KnowledgeFile = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,9) + (fileData.name?.substring(0,5) || 'file'),
      uploadDate: new Date().toISOString(),
      name: fileData.isTextEntry ? (fileData.name || "Untitled Text Entry").substring(0,100) : fileData.name || "Untitled File",
      type: fileData.isTextEntry ? "text/plain" : fileData.type || "unknown",
      size: fileData.isTextEntry ? (fileData.textContent || "").length : fileData.size || 0,
      product: fileData.product,
      persona: fileData.persona,
      category: fileData.category || inferCategoryFromName(fileData.name || "", fileData.type || ""),
      textContent: fileData.textContent,
      isTextEntry: !!fileData.isTextEntry,
      dataUri: fileData.dataUri,
    };
    setFiles(prevFiles => {
      const updatedFiles = [newEntry, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    return newEntry;
  }, [setFiles]);

  const addFilesBatch = useCallback((filesData: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>): KnowledgeFile[] => {
    const newEntries: KnowledgeFile[] = filesData.map((fileData, index) => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2,9) + (fileData.name?.substring(0,5) || 'file') + index,
      uploadDate: new Date().toISOString(),
      name: fileData.isTextEntry ? (fileData.name || "Untitled Text Entry").substring(0,100) : fileData.name || "Untitled File",
      type: fileData.isTextEntry ? "text/plain" : fileData.type || "unknown",
      size: fileData.isTextEntry ? (fileData.textContent || "").length : fileData.size || 0,
      product: fileData.product,
      persona: fileData.persona,
      category: fileData.category || inferCategoryFromName(fileData.name || "", fileData.type || ""),
      textContent: fileData.textContent,
      isTextEntry: !!fileData.isTextEntry,
      dataUri: fileData.dataUri,
    }));

    setFiles(prevFiles => {
      const updatedFiles = [...newEntries, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    return newEntries;
  }, [setFiles]);


  const deleteFile = useCallback((id: string) => {
    setFiles(prevFiles => (prevFiles || []).filter(file => file.id !== id));
  }, [setFiles]);

  const getUsedCohorts = useCallback((): CustomerCohort[] => {
    const usedPersonas = new Set<string>();
    (files || []).forEach(file => {
      if (file.persona) {
        usedPersonas.add(file.persona);
      }
    });
    const allCohorts = new Set([...CUSTOMER_COHORTS, ...Array.from(usedPersonas)]);
    return Array.from(allCohorts) as CustomerCohort[];
  }, [files]);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles, getUsedCohorts };
}
