
"use client";

import { useState, useEffect, useCallback, Dispatch, SetStateAction, useRef } from 'react';

type SetValue<T> = Dispatch<SetStateAction<T>>;

// --- Save Queue Implementation ---
// This queue ensures that writes to localStorage happen one at a time, preventing race conditions.
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
// --- End Save Queue Implementation ---


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
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        const saveTask = () => new Promise<void>((resolve, reject) => {
            try {
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
                resolve();
            } catch (error) {
                console.error(`Error setting localStorage key “${key}”:`, error);
                reject(error);
            }
        });

        addToSaveQueue(saveTask);

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
