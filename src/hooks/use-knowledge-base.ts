
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

Subscription Plan Visuals:
<img src="https://placehold.co/600x300.png" alt="ET Subscription Tiers" data-ai-hint="subscription chart" />

Pricing Tiers (Example):
- 1-Year Plan: ~₹214/month (billed annually) + credit card discount.
- 3-Year Plan: ~₹153/month (billed triennially) + credit card discount.
- 7-Year Plan: ~₹108/month (billed septennially) + credit card discount.
(Agent to always confirm current offers)

Feature Highlight:
<img src="https://placehold.co/300x200.png" alt="ETPrime Exclusive Content" data-ai-hint="exclusive content" />
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

Subscription Plan Visuals:
<img src="https://placehold.co/600x300.png" alt="TOI Subscription Tiers" data-ai-hint="subscription chart" />

Pricing Tiers (Example):
- 1-Year Plan: ~₹214/month (billed annually) + credit card discount.
- 2-Year Special Plan: ~₹149/month (billed biennially) + credit card discount.
- 3-Year Best Value Plan: ~₹122/month (billed triennially) + credit card discount.
(Agent to always confirm current offers)

Mobile App View:
<img src="https://placehold.co/250x400.png" alt="TOI+ App Interface" data-ai-hint="mobile app" />
`;


export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  useEffect(() => {
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
      textContent: fileData.textContent,
      isTextEntry: !!fileData.isTextEntry,
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
      textContent: fileData.textContent,
      isTextEntry: !!fileData.isTextEntry,
    }));

    setFiles(prevFiles => {
      // Add new entries to the beginning and then sort all by date
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
    return CUSTOMER_COHORTS.filter(cohort => usedPersonas.has(cohort));
  }, [files]);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles, getUsedCohorts };
}
