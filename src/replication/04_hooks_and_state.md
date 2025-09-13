# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Part 4

## **Part 4: Custom Hooks & Client-Side State**

This document provides the complete implementation of all custom React hooks used for managing client-side state, including `localStorage` interactions for products, knowledge base, and user activity.

---

### **4.1. Core Hooks**

#### **File: `src/hooks/use-local-storage.ts`**
**Purpose:** A generic hook to abstract interactions with the browser's `localStorage`, providing a `useState`-like interface.

```typescript
"use client";

import { useState, useEffect, useCallback, Dispatch, SetStateAction, useRef } from 'react';

type SetValue<T> = Dispatch<SetStateAction<T>>;

const saveQueue: (() => Promise<void>)[] = [];
let isProcessingQueue = false;

async function processSaveQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (saveQueue.length > 0) {
    const saveTask = saveQueue.shift();
    if (saveTask) {
      try {
        await saveTask();
      } catch (error) {
        console.error("Error processing save queue task:", error);
      }
    }
  }
  isProcessingQueue = false;
}

function addToSaveQueue(saveFunction: () => Promise<void>) {
  saveQueue.push(saveFunction);
  if (!isProcessingQueue) {
    processSaveQueue();
  }
}

export function useLocalStorage<T>(key: string, initialValueProp: T | (() => T)): [T, SetValue<T>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : (typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp);
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp;
        }
    });

    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const setValue: SetValue<T> = useCallback(value => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);

            const saveTask = () => new Promise<void>((resolve, reject) => {
                try {
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem(key, JSON.stringify(valueToStore));
                    }
                    resolve();
                } catch (error) {
                    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                        console.error(`Error setting localStorage key “${key}”: QUOTA EXCEEDED.`);
                    } else {
                        console.error(`Error setting localStorage key “${key}”:`, error);
                    }
                    reject(error);
                }
            });

            addToSaveQueue(saveTask);
        } catch(error) {
            console.error(`Error calculating value to store for key “${key}”:`, error);
        }
    }, [key, storedValue]);
    
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue && isMounted.current) {
                try {
                    setStoredValue(JSON.parse(e.newValue));
                } catch(err) {
                    console.error('Error parsing storage update:', err);
                }
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

---

#### **File: `src/hooks/use-mobile.ts`**
**Purpose:** A simple hook to detect if the user is on a mobile-sized screen.

```typescript
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
```

---

#### **File: `src/hooks/use-toast.ts`**
**Purpose:** Manages the global state for displaying toast notifications.

```typescript
"use client"

import * as React from "react"
import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// ... (rest of the standard useToast hook code) ...

export { useToast, toast }
```
*(Note: The full standard code for `useToast` is omitted for brevity as it is a well-known pattern, but it should be fully implemented as per ShadCN's default.)*

---

### **4.2. Application-Specific State Hooks**

#### **File: `src/hooks/use-activity-logger.ts`**
**Purpose:** Manages the global activity log, storing a list of user actions in `localStorage`.

```typescript
"use client";

import type { ActivityLogEntry, UserProfile, ScoreCallOutput } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile'; 
import { useCallback } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
export const MAX_ACTIVITIES_TO_STORE = 50;

const stripLargePayloads = (details: any): any => {
    if (typeof details !== 'object' || details === null) return details;
    const newDetails = { ...details };
    if ('audioDataUri' in newDetails) delete newDetails.audioDataUri;
    if (newDetails.materialOutput && typeof newDetails.materialOutput === 'object' && 'sections' in newDetails.materialOutput) {
        newDetails.materialOutput = {
            deckTitle: newDetails.materialOutput.deckTitle,
            sections: [{title: `(Content for ${newDetails.materialOutput.sections.length} sections is not stored in log)`, content: "" }]
        };
    }
    return newDetails;
};

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, () => []);
  const { currentProfile } = useUserProfile(); 

  const logActivity = useCallback((activityPayload: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>): string => {
    const newActivity: ActivityLogEntry = {
      ...activityPayload,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile,
      details: stripLargePayloads(activityPayload.details),
    };
    setActivities(prevActivities => {
      const updatedActivities = [newActivity, ...(prevActivities || [])];
      return updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
    });
    return newActivity.id; 
  }, [setActivities, currentProfile]);

  // ... (logBatchActivities, updateActivity, deleteActivities, clearAllActivities) ...

  return { activities: activities || [], logActivity, /* ... */ };
}
```
*(Note: Full implementation of all exported functions should be included.)*

---

#### **File: `src/hooks/use-product-context.tsx`**
**Purpose:** Manages the product catalog state, including default products.

```typescript
"use client";

import React, { createContext, useContext, useMemo, useCallback } from 'react';
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
    // ... (TOI and General product objects) ...
];

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [storedProducts, setStoredProducts] = useLocalStorage<ProductObject[]>(AVAILABLE_PRODUCTS_KEY, defaultProducts);
  
  // ... (Full implementation of addProduct, editProduct, deleteProduct, getProductByName) ...

  const sortedAvailableProducts = useMemo(() => {
    // ... (sorting logic) ...
    return storedProducts;
  }, [storedProducts]);

  const value = {
    availableProducts: sortedAvailableProducts,
    // ... (rest of functions) ...
  };

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

---

#### **File: `src/hooks/use-knowledge-base.ts`**
**Purpose:** Manages the knowledge base state, including default entries and file handling logic.

```typescript
"use client";

import type { KnowledgeFile, CustomerCohort, Product } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useCallback, useEffect } from 'react';
import { fileToDataUrl } from '@/lib/file-utils';

const KNOWLEDGE_BASE_KEY = 'aiTeleSuiteKnowledgeBase_v5_with_data_uri';

const defaultKnowledgeBase: KnowledgeFile[] = [
  // ET Product Entries
  { id: 'default-et-desc', name: "ET - Core Product Description", type: 'text/plain', size: 500, product: 'ET', category: 'Product Description', uploadDate: new Date().toISOString(), textContent: "ET Prime is the premium subscription service...", isTextEntry: true },
  // ... (all other default KB entries for ET and TOI) ...
];

export function useKnowledgeBase() {
  const [files, setFiles] = useLocalStorage<KnowledgeFile[]>(KNOWLEDGE_BASE_KEY, defaultKnowledgeBase);

  // ... (Full implementation of data migration, addFile, addFilesBatch, deleteFile) ...

  return { files: files || [], addFile, addFilesBatch, deleteFile, setFiles };
}
```

---

#### **File: `src/hooks/use-whisper.ts`**
**Purpose:** A robust hook for managing the browser's SpeechRecognition API, including state, silence detection for turn-taking, and inactivity detection for reminders.

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseWhisperProps {
  onTranscribe: (text: string) => void;
  onTranscriptionComplete: (text: string) => void;
  onRecognitionError?: (error: SpeechRecognitionErrorEvent) => void;
  silenceTimeout?: number; // For turn-taking
  inactivityTimeout?: number; // For reminders
}

export type RecognitionState = 'idle' | 'recording' | 'stopping';

export function useWhisper({
  onTranscribe,
  onTranscriptionComplete,
  onRecognitionError,
  silenceTimeout = 50,
  inactivityTimeout = 3000,
}: UseWhisperProps) {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // ... (Full, robust implementation of the hook as described in PROJECT_DESCRIPTION.md) ...
  
  const startRecording = useCallback(() => { /* ... */ }, []);
  const stopRecording = useCallback(() => { /* ... */ }, []);
  
  return {
    isRecording: recognitionState === 'recording',
    startRecording,
    stopRecording,
  };
}
```

---

This concludes Part 4.
