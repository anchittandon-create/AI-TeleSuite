
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v5_with_data_uri';

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

  // Backfill logic for old text entries
  useEffect(() => {
    const migrateFiles = async () => {
        if (files && files.length > 0) {
          let needsUpdate = false;
          const updatedFilesPromises = files.map(async (file) => {
            if (file.isTextEntry && file.textContent && !file.dataUri) {
              try {
                const textBlob = new Blob([file.textContent], {type : 'text/plain'});
                const dataUri = URL.createObjectURL(textBlob);
                needsUpdate = true;
                return { ...file, dataUri };
              } catch(e) {
                console.error(`Could not create Blob URL for existing text entry "${file.name}":`, e);
                return file;
              }
            }
            return file;
          });
          
          const updatedFiles = await Promise.all(updatedFilesPromises);
          
          if (needsUpdate) {
              setFiles(updatedFiles);
          }
        }
    };
    if (typeof window !== 'undefined') {
        setTimeout(migrateFiles, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const addFile = useCallback(async (entryData: RawTextKnowledgeEntry): Promise<KnowledgeFile> => {
    const textBlob = new Blob([entryData.textContent], {type: 'text/plain'});
    const objectUrl = URL.createObjectURL(textBlob);
    
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
      dataUri: objectUrl, // Now correctly a Blob URL
    };
    
    setFiles(prevFiles => {
      const updatedFiles = [newEntry, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    
    return newEntry;
  }, [setFiles]);


  const addFilesBatch = useCallback(async (entriesData: RawKnowledgeEntry[]): Promise<KnowledgeFile[]> => {
    const newEntriesPromises = entriesData.map(async (entryData, index) => {
        const file = entryData.file;
        let textContent: string | undefined = undefined;
        let objectUrl: string | undefined = undefined;

        try {
            // Use URL.createObjectURL for all files. It's synchronous and efficient.
            objectUrl = URL.createObjectURL(file);
        } catch (readError) {
            console.warn(`Could not create Blob URL for file ${file.name}, it will not be downloadable or previewable.`, readError);
        }

        const isTextReadable = file.type.startsWith('text/') || /\.(txt|csv|md)$/i.test(file.name);
        if (isTextReadable && file.size < MAX_TEXT_FILE_READ_SIZE) {
            try {
                textContent = await file.text();
            } catch (readError) {
                console.warn(`Could not read text content for file ${file.name}.`, readError);
            }
        }
        
        const newEntry: KnowledgeFile = {
            id: Date.now().toString() + Math.random().toString(36).substring(2,9) + (file.name?.substring(0,5) || 'file') + index,
            uploadDate: new Date().toISOString(),
            name: file.name || "Untitled File",
            type: file.type || "unknown",
            size: file.size,
            product: entryData.product,
            persona: entryData.persona,
            category: entryData.category || inferCategoryFromName(file.name, file.type),
            textContent: textContent,
            isTextEntry: false,
            dataUri: objectUrl, // Store the Blob URL
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
      const fileToDelete = (prevFiles || []).find(f => f.id === id);
      if (fileToDelete && fileToDelete.dataUri && fileToDelete.dataUri.startsWith('blob:')) {
          URL.revokeObjectURL(fileToDelete.dataUri);
      }
      return (prevFiles || []).filter(file => file.id !== id);
    });
  }, [setFiles]);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles };
}
