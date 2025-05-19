"use client";

import { KnowledgeFile } from '@/types';
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

  return { files, addFile, setFiles };
}
