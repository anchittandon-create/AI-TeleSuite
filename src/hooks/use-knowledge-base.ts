
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';
import { fileToDataUrl } from '@/lib/file-utils';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v5_with_data_uri';

// --- Default Knowledge Base Content ---
const defaultKnowledgeBase: KnowledgeFile[] = [
  // --- ET Product Entries ---
  {
    id: 'default-et-desc',
    name: "ET - Core Product Description",
    type: 'text/plain',
    size: 500,
    product: 'ET',
    category: 'Product Description',
    uploadDate: new Date().toISOString(),
    textContent: "ET Prime is the premium subscription service from The Economic Times, India's most respected business publication. It offers members exclusive access to deeply researched, investigative stories, and sharp, insightful analysis across more than 20 sectors. Key features include a completely ad-free reading experience on all platforms, the ET Portfolio management tool, daily stock reports, and over 25 curated sectoral newsletters. It is designed for business leaders, professionals, and serious investors who need to stay ahead of market trends and make informed decisions.",
    isTextEntry: true,
  },
  {
    id: 'default-et-pitch',
    name: "ET - Standard Sales Pitch",
    type: 'text/plain',
    size: 450,
    product: 'ET',
    category: 'Pitch',
    uploadDate: new Date().toISOString(),
    textContent: "Hello {{userName}}, this is {{agentName}} calling from The Economic Times. I'm reaching out because our records show you've shown interest in our premium content. I wanted to take just a moment to share how an ET Prime membership can provide you with exclusive, data-driven stories and market analysis you won't find anywhere else. It's specifically designed to help professionals like you make smarter business and investment decisions. Are you familiar with our premium features?",
    isTextEntry: true,
  },
  {
    id: 'default-et-pricing',
    name: "ET - Pricing Information",
    type: 'text/plain',
    size: 300,
    product: 'ET',
    category: 'Pricing',
    uploadDate: new Date().toISOString(),
    textContent: "We offer several flexible subscription plans for ET Prime. Our most popular option is the 1-Year plan. For greater value, we also have 2-Year and 3-Year plans that come with significant savings. Each plan provides full, unrestricted access to all ET Prime features, including our ad-free experience and exclusive content.",
    isTextEntry: true,
  },
  {
    id: 'default-et-rebuttals',
    name: "ET - Common Rebuttals",
    type: 'text/plain',
    size: 600,
    product: 'ET',
    category: 'Rebuttals',
    uploadDate: new Date().toISOString(),
    textContent: "Objection: It's too expensive.\nRebuttal: I understand that cost is an important consideration. That's why many of our members see ET Prime not as an expense, but as an investment. The exclusive insights and analysis can help you identify opportunities or avoid risks that far outweigh the subscription cost. For example, a single insight from our stock reports could make a significant difference to your portfolio.\n\nObjection: I don't have time to read.\nRebuttal: I can certainly appreciate how busy you are, and that's exactly why ET Prime is so valuable. Our content is concise, and our newsletters provide curated briefings that save you time while keeping you informed on what truly matters in your sector. It's about getting the most critical information efficiently.",
    isTextEntry: true,
  },

  // --- TOI Product Entries ---
  {
    id: 'default-toi-desc',
    name: "TOI+ - Core Product Description",
    type: 'text/plain',
    size: 450,
    product: 'TOI',
    category: 'Product Description',
    uploadDate: new Date().toISOString(),
    textContent: "TOI+ is the premium digital subscription from The Times of India, offering readers access to exclusive, in-depth articles, investigative journalism, and expert opinions on the stories that matter most. It provides a deeper understanding of current events, beyond the daily news cycle. Subscribers enjoy an ad-lite experience on the website and app, along with access to over 200 exclusive stories each month and special long-form content.",
    isTextEntry: true,
  },
  {
    id: 'default-toi-pitch',
    name: "TOI - Standard Sales Pitch",
    type: 'text/plain',
    size: 400,
    product: 'TOI',
    category: 'Pitch',
    uploadDate: new Date().toISOString(),
    textContent: "Hello {{userName}}, I'm {{agentName}} from The Times of India. I noticed you enjoy our news coverage, and I wanted to briefly introduce you to TOI+, our premium subscription service. It's for readers who want to go deeper into the stories shaping our world, with exclusive articles and expert analysis you won't find in our free content. Would you be interested in hearing more about the benefits?",
    isTextEntry: true,
  },
  {
    id: 'default-toi-pricing',
    name: "TOI - Pricing Information",
    type: 'text/plain',
    size: 250,
    product: 'TOI',
    category: 'Pricing',
    uploadDate: new Date().toISOString(),
    textContent: "TOI+ offers flexible subscription options, including Monthly, Quarterly, and Annual plans to suit your reading habits. The Annual plan offers the best value for money, giving you a full year of unlimited access to our premium content.",
    isTextEntry: true,
  },
  {
    id: 'default-toi-rebuttals',
    name: "TOI - Common Rebuttals",
    type: 'text/plain',
    size: 400,
    product: 'TOI',
    category: 'Rebuttals',
    uploadDate: new Date().toISOString(),
    textContent: "Objection: I get all my news for free.\nRebuttal: That's a fair point, as there is a lot of free news available. What our TOI+ members value is the trusted, in-depth analysis and exclusive stories that provide a much deeper perspective than surface-level news. It's about understanding the 'why' behind the headlines.",
    isTextEntry: true,
  },
];

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
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, defaultKnowledgeBase);

  // --- DATA MIGRATION ---
  useEffect(() => {
    if (files && files.length > 0) {
      let needsUpdate = false;
      const migratedFiles = files.map(file => {
        if (!file.isTextEntry && file.dataUri) {
          needsUpdate = true;
          // Create a new object without the dataUri property
          const { dataUri, ...rest } = file;
          return rest;
        }
        // Also ensure dataUri exists for text entries for download consistency
        if (file.isTextEntry && !file.dataUri) {
            needsUpdate = true;
            const blob = new Blob([file.textContent || ''], { type: 'text/plain' });
            return { ...file, dataUri: URL.createObjectURL(blob) }; // Not persistent, but useful for current session download
        }
        return file;
      });

      if (needsUpdate) {
        console.log("Migrating Knowledge Base: Removing large Data URIs from file entries and ensuring text entries have session URIs.");
        setFiles(migratedFiles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      dataUri: await fileToDataUrl(new Blob([entryData.textContent], {type: 'text/plain'})),
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
        
        // Convert file to dataUri for session use (preview, download)
        // This will NOT be persisted in the final object that goes to localStorage
        const sessionDataUri = await fileToDataUrl(file);

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
            // Add the session-only dataUri here
            dataUri: sessionDataUri
        };
        return newEntry;
    });

    const newEntriesWithDataUri = await Promise.all(newEntriesPromises);

    // Now, create the versions that will be persisted, WITHOUT the dataUri for non-text files
    const newEntriesForStorage = newEntriesWithDataUri.map(entry => {
        const { dataUri, ...rest } = entry;
        // Only text entries persist their content, not the dataUri
        if (rest.isTextEntry) {
            return entry; 
        }
        return rest; // For binary files, the dataUri is stripped before saving
    });


    setFiles(prevFiles => {
      const updatedFiles = [...newEntriesForStorage, ...(prevFiles || [])];
      return updatedFiles.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    });
    
    // Return the full objects with the session dataUri to the calling component
    return newEntriesWithDataUri;
  }, [setFiles]);


  const deleteFile = useCallback((id: string) => {
    setFiles(prevFiles => {
      return (prevFiles || []).filter(file => file.id !== id);
    });
  }, [setFiles]);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles };
}
