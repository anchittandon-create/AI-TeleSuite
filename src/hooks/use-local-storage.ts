
"use client";

import { useState, useEffect } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  // Always initialize with initialValue to ensure server and initial client render match.
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Effect to read from localStorage on client mount.
  useEffect(() => {
    // This check ensures localStorage is accessed only on the client.
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) { // Check for null to avoid parsing "null" string
          setStoredValue(JSON.parse(item));
        }
        // If item is null, storedValue remains initialValue, which is correct.
      } catch (error) {
        console.error(`Error reading localStorage key "${key}" on client mount:`, error);
        // In case of error, storedValue remains initialValue.
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [key]); // Only run on mount (and if key changes, though unlikely for this hook's usage pattern)

  // Effect to update local storage when the state changes.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
