
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { CUSTOMER_COHORTS, PRODUCTS } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase';

const ET_PRIME_DEFAULT_NAME = "Comprehensive ET Prime Product Details (System Default)";
const TOI_PLUS_DEFAULT_NAME = "Comprehensive TOI Plus Product Details (System Default)";

const ET_PRIME_COMPREHENSIVE_DETAILS = `
Product: ET Prime
Overview:
ET Prime is a premium digital subscription product by The Economic Times. It focuses on business, finance, policy, and tech, offering deep insights and original reporting beyond regular headlines.
Key Benefits:
- Deep-Dive Business Journalism:
  - In-depth articles across sectors: Finance, Economy, Markets, Startups, Auto, Healthcare, Policy
  - Expert columns from veterans in industry and market analysts
- Stock Market & Wealth Insights:
  - Daily stock recommendations
  - Sectoral outlooks
  - Wealth reports: Long-term investing strategies, Big Bull Portfolio, and Stock Reports Plus
  - Weekly and monthly investment guides
- Premium Newsletters & Briefings:
  - “ET Prime Morning Brief” – a daily curated email with everything that matters in business
  - Industry-specific newsletters (e.g., Finance, Startups, Technology, Auto)
- Ad-Free Experience:
  - Clean, uninterrupted reading with no banners, pop-ups, or third-party ads
- ET Prime ePaper Access:
  - Full access to ET’s digital newspaper (PDF and web format)
  - Archives included
- Subscriber-Only Research Reports:
  - Access to exclusive ET Intelligence Group (ETIG) reports and proprietary data analyses
- Events & Webinars:
  - Invitations to premium business webinars, roundtables, and expert Q&A sessions
- Customizable Dashboard:
  - Personalized reading list and topic preference filters
- Offline Reading & App Features:
  - Save articles, download reports, and read offline via the ET Prime mobile app
Bundling Options:
- Often sold standalone or bundled with TimesPrime and/or TOI Plus
- Offers range from 1 month to 7 years (longer plans have higher discounts)
Common Selling Themes:
- Value for Money: "Just ₹5 a day for both in-depth analysis and premium news access"
- Productivity Boost: “Stay ahead without noise – only what matters, clearly explained”
- Decision-Making Edge: “From market picks to policy shifts – gain the edge in business and life”
- Trust & Brand Legacy: “From India’s most respected newsroom”
- Content Ownership: “You’re not reading what everyone else is – you’re investing in better news”
`;

const TOI_PLUS_COMPREHENSIVE_DETAILS = `
Product: TOI Plus
Overview:
TOI Plus is the premium subscription product of The Times of India. It enhances the general news experience with curated, ad-free content, deeper commentary, and opinion-rich journalism.
Key Benefits:
- Ad-Free News Reading:
  - Enjoy The Times of India app and website without any advertisements
  - Cleaner, faster, distraction-free experience
- Premium Editorial Content:
  - Access to exclusive opinion columns from top journalists
  - Deep dives into trending stories, context-rich features, and longform articles
  - Less clickbait, more substance
- ePaper Access:
  - Digital replica of the day’s TOI newspaper
  - Browse by city/edition and download PDFs
  - Includes archives and regional language editions
- Morning & Evening Briefs:
  - Handpicked headlines and summaries, curated by editors
  - Get the most important news in 2 minutes
- Special Coverage on National Issues:
  - Civic journalism, campaigns, changemaker stories
  - Health, education, environment deep-dives
- Unlimited Access:
  - Remove article caps — unlock full content across TOI network
- Custom Notifications & Topic Alerts:
  - Personalized notification preferences based on interests
- Seamless Integration Across Devices:
  - Unified access across app, web, and ePaper platforms
Bundling Options:
- Frequently bundled with ET Prime, TimesPrime, and Docubay
- Popular plan: 1-year TOI Plus + ET Prime combo at discounted pricing
- Available from 3 months to 3 years
Common Selling Themes:
- Value for Money: "Just ₹5 a day for both in-depth analysis and premium news access"
- Productivity Boost: “Stay ahead without noise – only what matters, clearly explained”
- Decision-Making Edge: “From market picks to policy shifts – gain the edge in business and life”
- Trust & Brand Legacy: “From India’s most respected newsroom”
- Content Ownership: “You’re not reading what everyone else is – you’re investing in better news”
`;


export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, []);

  useEffect(() => {
    const currentFiles = files || [];

    const currentEtDefault = currentFiles.find(f => f.name === ET_PRIME_DEFAULT_NAME);
    const currentToiDefault = currentFiles.find(f => f.name === TOI_PLUS_DEFAULT_NAME);

    const etDefaultNeedsUpdate = !currentEtDefault || currentEtDefault.textContent !== ET_PRIME_COMPREHENSIVE_DETAILS;
    const toiDefaultNeedsUpdate = !currentToiDefault || currentToiDefault.textContent !== TOI_PLUS_COMPREHENSIVE_DETAILS;

    // Check if the number of user files would change if we removed the current defaults
    // This helps catch scenarios where one default exists but not the other, or if names were somehow duplicated by user.
    let nonDefaultFileCount = 0;
    for (const file of currentFiles) {
        if (file.name !== ET_PRIME_DEFAULT_NAME && file.name !== TOI_PLUS_DEFAULT_NAME) {
            nonDefaultFileCount++;
        }
    }
    // If after removing current defaults, the count of remaining files doesn't match nonDefaultFileCount, an update is needed.
    const userFilesStructureChanged = (currentFiles.length - (currentEtDefault ? 1 : 0) - (currentToiDefault ? 1 : 0)) !== nonDefaultFileCount;


    if (etDefaultNeedsUpdate || toiDefaultNeedsUpdate || userFilesStructureChanged) {
      const userAddedFiles = currentFiles.filter(
        f => f.name !== ET_PRIME_DEFAULT_NAME && f.name !== TOI_PLUS_DEFAULT_NAME
      );

      const newSystemDefaultEntries: KnowledgeFile[] = [
        {
          id: Date.now().toString() + Math.random().toString(36).substring(2,9) + "ETPrimeDefault",
          uploadDate: new Date().toISOString(),
          name: ET_PRIME_DEFAULT_NAME,
          type: "text/plain",
          size: ET_PRIME_COMPREHENSIVE_DETAILS.length,
          product: "ET",
          textContent: ET_PRIME_COMPREHENSIVE_DETAILS,
          isTextEntry: true,
        },
        {
          id: Date.now().toString() + Math.random().toString(36).substring(2,9) + "TOIPlusDefault",
          uploadDate: new Date().toISOString(),
          name: TOI_PLUS_DEFAULT_NAME,
          type: "text/plain",
          size: TOI_PLUS_COMPREHENSIVE_DETAILS.length,
          product: "TOI",
          textContent: TOI_PLUS_COMPREHENSIVE_DETAILS,
          isTextEntry: true,
        },
      ];
      
      // Old default names to also filter out if they exist from a very old version
      const oldDefaultNames = ["Example: Core ET Product Information", "Example: Core TOI Product Information"];
      const trulyUserAddedFiles = userAddedFiles.filter(f => !oldDefaultNames.includes(f.name));

      setFiles([...newSystemDefaultEntries, ...trulyUserAddedFiles].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
    }
  }, [files, setFiles]); // Effect runs when `files` (from localStorage) or `setFiles` changes. `setFiles` should be stable.

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
    // Ensure all standard cohorts are always available, plus any used ones.
    const allCohorts = new Set([...CUSTOMER_COHORTS, ...Array.from(usedPersonas)]);
    return Array.from(allCohorts) as CustomerCohort[];
  }, [files]);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles, getUsedCohorts };
}

