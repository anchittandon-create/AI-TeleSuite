
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { CUSTOMER_COHORTS } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v5_with_data_uri';

const inferCategoryFromName = (name: string, type: string): string => {
    const lowerName = name.toLowerCase();
    const lowerType = type.toLowerCase();
    
    if (lowerName.includes('pricing') || lowerName.includes('price')) {
        return 'Pricing';
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

// Function to convert Blob to Data URL
function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
}

export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  // Migration and backfill effect
  useEffect(() => {
    if (files && files.length > 0) {
      let needsUpdate = false;
      const updatePromises = files.map(async file => {
        if (file.isTextEntry && file.textContent && !file.dataUri) {
          try {
            const textBlob = new Blob([file.textContent], {type : 'text/plain'});
            const dataUri = await blobToDataURL(textBlob);
            needsUpdate = true;
            return { ...file, dataUri };
          } catch(e) {
            console.error("Could not create data URI for existing text entry:", e);
            return file;
          }
        }
        return file;
      });
      
      Promise.all(updatePromises).then(updatedFiles => {
          if (needsUpdate) {
              setFiles(updatedFiles);
          }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount to check for migrations


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
