
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { CUSTOMER_COHORTS, PRODUCTS } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase';

const DEFAULT_ET_KNOWLEDGE_CONTENT = `
Product: Economic Times (ET)
Key Selling Points:
- ETPrime Subscription: Exclusive, in-depth news, investigative reports, expert opinions, and actionable insights.
- Ad-Light Experience: Premium reading for focused content consumption.
- Digital Access: E-paper, archives, ET Portfolio, Stock Screener.
- Credibility: Renowned journalists and industry leaders.
Target Audience: Business professionals, investors, policymakers, students.
Common Objections: Cost, information overload.
Pricing Tiers (Example):
- 1-Year Plan: ~₹214/month (billed annually) + credit card discount.
- 3-Year Plan: ~₹153/month (billed triennially) + credit card discount.
- 7-Year Plan: ~₹108/month (billed septennially) + credit card discount.
(Agent to always confirm current offers)
`;

const DEFAULT_TOI_KNOWLEDGE_CONTENT = `
Product: Times of India (TOI)
Key Selling Points:
- TOI+ Subscription: Comprehensive news (India & Global), in-depth articles, opinion pieces, exclusive interviews.
- Enhanced Digital Experience: Personalized news feeds, offline reading.
- Archives Access: Access to TOI's historical articles and special editions.
- Trust & Reach: India's leading English daily.
Target Audience: General readers, students, families, anyone interested in current affairs.
Common Objections: Preference for free news, specific content needs.
Pricing Tiers (Example):
- 1-Year Plan: ~₹214/month (billed annually) + credit card discount.
- 2-Year Special Plan: ~₹149/month (billed biennially) + credit card discount.
- 3-Year Best Value Plan: ~₹122/month (billed triennially) + credit card discount.
(Agent to always confirm current offers)
`;


export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  useEffect(() => {
    // Initialize with default entries only if the files array is currently empty
    // This check prevents re-adding defaults if files is null/undefined during SSR then hydrated
    if (files && files.length === 0) {
      const defaultEntries: Omit<KnowledgeFile, 'id' | 'uploadDate'>[] = [
        {
          name: "Example: Core ET Product Information",
          type: "text/plain",
          size: DEFAULT_ET_KNOWLEDGE_CONTENT.length,
          product: "ET",
          textContent: DEFAULT_ET_KNOWLEDGE_CONTENT,
          isTextEntry: true,
        },
        {
          name: "Example: Core TOI Product Information",
          type: "text/plain",
          size: DEFAULT_TOI_KNOWLEDGE_CONTENT.length,
          product: "TOI",
          textContent: DEFAULT_TOI_KNOWLEDGE_CONTENT,
          isTextEntry: true,
        },
      ];
      
      const initializedFiles = defaultEntries.map(entry => ({
        ...entry,
        id: Date.now().toString() + Math.random().toString(36).substring(2,9) + entry.name.substring(0,5),
        uploadDate: new Date().toISOString(),
      }));
      setFiles(initializedFiles);
    }
  }, []); // Run once on mount if files are empty. Do not re-run if `files` changes. `setFiles` is stable.

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

  return { files: files || [], addFile, deleteFile, setFiles, getUsedCohorts };
}
