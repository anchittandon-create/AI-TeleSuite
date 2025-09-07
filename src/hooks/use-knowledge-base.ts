
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v6_metadata_only';

const MAX_TEXT_FILE_READ_SIZE = 2 * 1024 * 1024; // 2MB limit for reading text content

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
    // THIS FUNCTION NO LONGER READS FILE CONTENT TO PREVENT LOCALSTORAGE QUOTA ERRORS.
    // IT ONLY STORES METADATA.
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
