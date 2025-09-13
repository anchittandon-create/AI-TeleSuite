# Replication Prompt: Part 4 - Custom Hooks & Client-Side State

This document details the implementation of all custom React hooks responsible for managing client-side state, primarily using `localStorage`.

---

### **1. `useLocalStorage`**

This is the foundational hook for all local persistence.

#### **File: `src/hooks/use-local-storage.ts`**
```typescript
"use client";

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

type SetValue<T> = Dispatch<SetStateAction<T>>;

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)): [T, SetValue<T>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : (typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue);
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
        }
    });

    const setValue: SetValue<T> = useCallback(value => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, storedValue]);
    
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                setStoredValue(JSON.parse(e.newValue));
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [key]);

    return [storedValue, setValue];
}
```
**Purpose:** A generic hook to abstract reading from and writing to `localStorage`, ensuring state is synced across browser tabs.

---

### **2. `useUserProfile`**

Manages the currently active user profile for logging purposes.

#### **File: `src/hooks/use-user-profile.ts`**
```typescript
"use client";

import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types';
import { useCallback } from 'react';

const USER_PROFILE_KEY = 'aiTeleSuiteActiveUserProfile';

interface UserProfileHookValue {
  currentProfile: UserProfile;
  setCurrentProfile: (profile: UserProfile) => void;
}

export const useUserProfile = (): UserProfileHookValue => {
  const [currentProfile, setCurrentProfileInternal] = useLocalStorage<UserProfile>(
    USER_PROFILE_KEY,
    "Anchit" // Default value
  );

  const setCurrentProfile = useCallback((profile: UserProfile) => {
    setCurrentProfileInternal(profile);
  }, [setCurrentProfileInternal]);

  return { currentProfile: currentProfile || "Anchit", setCurrentProfile };
};
```
**Purpose:** Provides a simple way to get and set the current user profile, which is persisted in `localStorage`.

---

### **3. `useProductContext` (with Initial Data)**

Manages the application's product catalog.

#### **File: `src/hooks/useProductContext.tsx`**
```typescript
"use client";

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import { ProductObject } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts_v3';

interface ProductContextType {
  availableProducts: ProductObject[];
  addProduct: (product: Omit<ProductObject, 'name'>) => boolean;
  editProduct: (originalName: string, updatedProduct: Omit<ProductObject, 'name'>) => boolean;
  deleteProduct: (nameToDelete: string) => boolean;
  getProductByName: (name: string) => ProductObject | undefined;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

// **INITIAL DATA STATE**
const defaultProducts: ProductObject[] = [
    { 
        name: "ET", 
        displayName: "ET", 
        description: "Economic Times - Premium business news and analysis.", 
        brandName: "The Economic Times", 
        brandUrl: "https://economictimes.indiatimes.com/",
        customerCohorts: ["Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Expired Users", "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives"],
        salesPlans: ["1-Year", "2-Years", "3-Years"],
        specialPlanConfigurations: ["1, 3 and 5 year plans", "1, 3 and 7 year plans"],
    },
    { 
        name: "TOI", 
        displayName: "TOI", 
        description: "Times of India - In-depth news and journalism.", 
        brandName: "The Times of India", 
        brandUrl: "https://timesofindia.indiatimes.com/",
        customerCohorts: ["Payment Dropoff", "Paywall Dropoff", "Expired Users", "New Prospect Outreach", "Young Professionals", "Students"],
        salesPlans: ["Monthly", "Quarterly", "1-Year"],
        specialPlanConfigurations: [],
    },
    { 
        name: "General", 
        displayName: "General", 
        description: "For general purpose use across features.",
        brandName: "",
        brandUrl: "",
        customerCohorts: [],
        salesPlans: [],
        specialPlanConfigurations: [],
    }
];

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [storedProducts, setStoredProducts] = useLocalStorage<ProductObject[]>(AVAILABLE_PRODUCTS_KEY, defaultProducts);

  const addProduct = useCallback(/* ... */);
  const editProduct = useCallback(/* ... */);
  const deleteProduct = useCallback(/* ... */);
  const getProductByName = useCallback(/* ... */);

  const sortedAvailableProducts = useMemo(() => {
    // ... sorting logic ...
  }, [storedProducts]);

  const value = { availableProducts: sortedAvailableProducts, addProduct, editProduct, deleteProduct, getProductByName };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProductContext = (): ProductContextType => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
};
```
**Purpose:** Provides a global context for managing the product catalog. It initializes `localStorage` with a set of default products. *(Note: CRUD function implementations are included in the full source but truncated here for index brevity.)*

---

### **4. `useKnowledgeBase` (with Initial Data)**

Manages all documents and text snippets in the Knowledge Base.

#### **File: `src/hooks/use-knowledge-base.ts`**
```typescript
"use client";

import type { KnowledgeFile } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';
import { fileToDataUrl } from '@/lib/file-utils';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v5_with_data_uri';

// **INITIAL DATA STATE**
const defaultKnowledgeBase: KnowledgeFile[] = [
  // --- ET Product Entries ---
  {
    id: 'default-et-desc',
    name: "ET - Core Product Description",
    type: 'text/plain', size: 500, product: 'ET', category: 'Product Description',
    uploadDate: new Date().toISOString(),
    textContent: "ET Prime is the premium subscription service...",
    isTextEntry: true,
  },
  // ... (all 8 default KB entries as defined in the source)
];

export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, defaultKnowledgeBase);
  
  const addFile = useCallback(/* ... */);
  const addFilesBatch = useCallback(/* ... */);
  const deleteFile = useCallback(/* ... */);

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles };
}
```
**Purpose:** Provides functions to add, delete, and retrieve knowledge base entries. It initializes `localStorage` with a set of default entries for the "ET" and "TOI" products. *(Note: Implementations truncated for index brevity.)*

---

### **5. `useWhisper`**

Manages the browser's SpeechRecognition API for robust voice input.

#### **File: `src/hooks/useWhisper.ts`**
```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

// ... (full implementation of the useWhisper hook as in the source file)

export function useWhisper({ /* ... */ }: UseWhisperProps) {
  // ...
  return {
    isRecording: recognitionState === 'recording',
    startRecording,
    stopRecording,
  };
}
```
**Purpose:** A hardened hook to manage the browser's SpeechRecognition API. It handles starting/stopping recording, provides real-time interim transcripts (for barge-in), detects silence for turn-taking, and manages an inactivity timer for reminder prompts. It is architected for stability by creating the `SpeechRecognition` instance only once.