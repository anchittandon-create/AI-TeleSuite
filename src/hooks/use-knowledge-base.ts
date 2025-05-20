
"use client";

import { KnowledgeFile, CUSTOMER_COHORTS, CustomerCohort, Product, PRODUCTS } from '@/types'; // Added Product, PRODUCTS
import { useLocalStorage } from './use-local-storage';

const KNOWLEDGE_BASE_KEY = 'pitchPerfectKnowledgeBase';

export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  const addFile = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    const newEntry: KnowledgeFile = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      uploadDate: new Date().toISOString(),
      name: fileData.isTextEntry ? (fileData.textContent || "Untitled Text Entry").substring(0,100) : fileData.name || "Untitled File",
      type: fileData.isTextEntry ? "text/plain" : fileData.type || "unknown",
      size: fileData.isTextEntry ? (fileData.textContent || "").length : fileData.size || 0,
      product: fileData.product,
      persona: fileData.persona,
      textContent: fileData.textContent,
      isTextEntry: !!fileData.isTextEntry,
    };
    setFiles(prevFiles => [newEntry, ...prevFiles].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
    return newEntry;
  };

  const deleteFile = (id: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== id));
  };

  const getUsedCohorts = (): CustomerCohort[] => {
    const usedPersonas = new Set<string>();
    files.forEach(file => {
      if (file.persona) {
        usedPersonas.add(file.persona);
      }
    });
    
    return CUSTOMER_COHORTS.filter(cohort => usedPersonas.has(cohort));
  };

  return { files, addFile, deleteFile, setFiles, getUsedCohorts };
}
