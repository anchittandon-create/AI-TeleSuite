
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';

// REVERTED to the original key to find the user's existing data.
const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v5_with_data_uri';

const inferCategoryFromName = (name: string, type: string): string => {
    const lowerName = name.toLowerCase();
    
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

// Types for the raw data coming from the form
export type RawKnowledgeEntry = {
    product: string;
    persona?: CustomerCohort;
    category?: string;
    isTextEntry: false;
    file: File;
}
export type RawTextKnowledgeEntry = {
    product: string;
    persona?: CustomerCohort;
    category?: string;
    isTextEntry: true;
    name: string;
    textContent: string;
}


export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  // --- DATA MIGRATION ---
  // This useEffect will run once on component mount to clean up old data.
  // It removes the large dataUri from file-based entries to prevent quota errors.
  useEffect(() => {
    if (files && files.length > 0) {
      let needsUpdate = false;
      const migratedFiles = files.map(file => {
        // If it's a file upload (not a text entry) and it has a dataUri, remove it.
        if (!file.isTextEntry && file.dataUri) {
          needsUpdate = true;
          const { dataUri, ...rest } = file; // Create a new object without the dataUri
          return rest;
        }
        return file;
      });

      if (needsUpdate) {
        console.log("Migrating Knowledge Base: Removing large Data URIs from file entries to prevent storage errors.");
        setFiles(migratedFiles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once

  const addFile = useCallback(async (entryData: RawTextKnowledgeEntry): Promise<KnowledgeFile> => {
    const newEntry: KnowledgeFile = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,9) + (entryData.name?.substring(0,5) || 'text'),
      uploadDate: new Date().toISOString(),
      name: (entryData.name || "Untitled Text Entry").substring(0,100),
      type: "text/plain",
      size: entryData.textContent.length,
      product: entryData.product,
      persona: entryData.persona,
      category: entryData.category || 'General',
      textContent: entryData.textContent,
      isTextEntry: true,
      // dataUri for text entries is small and can be stored.
      dataUri: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(entryData.textContent)))}`,
    };
    
    setFiles(prevFiles => {
      const updatedFiles = [newEntry, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    
    return newEntry;
  }, [setFiles]);


  const addFilesBatch = useCallback(async (entriesData: RawKnowledgeEntry[]): Promise<KnowledgeFile[]> => {
    // This function now correctly ONLY stores metadata for files.
    const newEntriesPromises = entriesData.map(async (entryData, index) => {
        const file = entryData.file;
        
        const newEntry: KnowledgeFile = {
            id: Date.now().toString() + Math.random().toString(36).substring(2,9) + (file.name?.substring(0,5) || 'file') + index,
            uploadDate: new Date().toISOString(),
            name: file.name || "Untitled File",
            type: file.type || "unknown",
            size: file.size,
            product: entryData.product,
            persona: entryData.persona,
            category: entryData.category || inferCategoryFromName(file.name, file.type),
            isTextEntry: false,
            // DO NOT store textContent or dataUri for files in localStorage.
        };
        return newEntry;
    });

    const newEntries = await Promise.all(newEntriesPromises);

    setFiles(prevFiles => {
      const updatedFiles = [...newEntries, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    
    return newEntries;
  }, [setFiles]);


  const deleteFile = useCallback((id: string) => {
    setFiles(prevFiles => {
      return (prevFiles || []).filter(file => file.id !== id);
    });
  }, [setFiles]);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles };
}
