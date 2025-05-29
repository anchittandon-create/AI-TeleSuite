
"use client";

import { useState, useEffect } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let item = null;
      try {
        item = window.localStorage.getItem(key);
        if (item !== null) {
          setStoredValue(JSON.parse(item));
        }
      } catch (error) {
        console.error(`Error parsing localStorage key "${key}". Potentially corrupted data.`, error);
        console.error("Problematic item string from localStorage:", item); // Log the item if possible
        // Attempt to clear the problematic key to allow recovery
        try {
          window.localStorage.removeItem(key);
          console.log(`Cleared problematic key "${key}" from localStorage. Please retry the action.`);
          // Revert to initial value after clearing
          setStoredValue(initialValue); 
        } catch (removeError) {
          console.error(`Failed to remove problematic key "${key}" from localStorage.`, removeError);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only run on mount (and if key changes)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (storedValue === undefined || storedValue === null) {
            // Avoid storing null/undefined if initialValue wasn't meant to be that
            if (initialValue !== undefined && initialValue !== null) {
                 window.localStorage.setItem(key, JSON.stringify(initialValue));
            } else {
                 window.localStorage.removeItem(key); // Or store as is if intended
            }
        } else {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue, initialValue]);

  return [storedValue, setStoredValue];
}
