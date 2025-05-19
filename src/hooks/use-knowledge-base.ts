
"use client";

import { KnowledgeFile, CUSTOMER_COHORTS, CustomerCohort } from '@/types';
import { useLocalStorage } from './use-local-storage';

const KNOWLEDGE_BASE_KEY = 'pitchPerfectKnowledgeBase';

export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  const addFile = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    const newFile: KnowledgeFile = {
      ...fileData,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      uploadDate: new Date().toISOString(),
    };
    setFiles(prevFiles => [newFile, ...prevFiles]);
    return newFile;
  };

  const getUsedCohorts = (): CustomerCohort[] => {
    const usedPersonas = new Set<string>();
    files.forEach(file => {
      if (file.persona) {
        usedPersonas.add(file.persona);
      }
    });
    
    // Filter against the master list to ensure validity and correct typing
    return CUSTOMER_COHORTS.filter(cohort => usedPersonas.has(cohort));
  };

  return { files, addFile, setFiles, getUsedCohorts };
}
