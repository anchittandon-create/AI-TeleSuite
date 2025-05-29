
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types'; // Updated type import
import { CUSTOMER_COHORTS, PRODUCTS } from '@/types'; // Added value import
import { useLocalStorage } from './use-local-storage';
import { useCallback } from 'react';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase';

export function useKnowledgeBase() {
  // Pass the initial value directly. useLocalStorage will handle initializing from storage.
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, () => []);

  const addFile = useCallback((fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    const newEntry: KnowledgeFile = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      uploadDate: new Date().toISOString(),
      name: fileData.isTextEntry ? (fileData.name || "Untitled Text Entry").substring(0,100) : fileData.name || "Untitled File",
      type: fileData.isTextEntry ? "text/plain" : fileData.type || "unknown",
      size: fileData.isTextEntry ? (fileData.textContent || "").length : fileData.size || 0,
      product: fileData.product,
      persona: fileData.persona,
      textContent: fileData.textContent,
      isTextEntry: !!fileData.isTextEntry,
    };
    setFiles(prevFiles => {
      const updatedFiles = [newEntry, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    return newEntry;
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
    return CUSTOMER_COHORTS.filter(cohort => usedPersonas.has(cohort));
  }, [files]);

  // Ensure files is always an array for consumers
  return { files: files || [], addFile, deleteFile, setFiles, getUsedCohorts };
}
