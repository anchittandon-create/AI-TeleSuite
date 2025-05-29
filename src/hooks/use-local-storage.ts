
"use client";

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // useEffect to update the state from localStorage when the component mounts on the client
  useEffect(() => {
    // Prevent execution on server
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        // console.log(`useLocalStorage: Reading from key "${key}", item found:`, String(item).substring(0,100));
        setStoredValue(JSON.parse(item));
      } else {
        // console.log(`useLocalStorage: Reading from key "${key}", no item found, setting initialValue to storage.`);
        // If no item, it means we should use initialValue, which is already the state.
        // We set it in localStorage if it wasn't there.
        window.localStorage.setItem(key, JSON.stringify(initialValue));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}": `, error);
      // console.error("Problematic item string from localStorage:", typeof window !== 'undefined' ? window.localStorage.getItem(key) : 'N/A');
      // If error, fall back to initial value and try to clear the corrupted key
      setStoredValue(initialValue);
      try {
        window.localStorage.removeItem(key);
        // console.log(`Cleared problematic key "${key}" from localStorage.`);
        window.localStorage.setItem(key, JSON.stringify(initialValue)); // Set initial value after clearing
      } catch (removeError) {
        console.error(`Failed to remove/reset problematic key "${key}" from localStorage.`, removeError);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run on mount (if key changes, which it shouldn't for a stable hook instance)

  // useEffect to update localStorage when the storedValue state changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      // console.log(`useLocalStorage: Writing to key "${key}", value:`, String(storedValue).substring(0,100));
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}": `, error);
      // console.error(`Value that failed to stringify (first 100 chars):`, String(storedValue).substring(0,100));
    }
  }, [key, storedValue]);

  const setValueWrapper = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
    } catch (error)
      // console.error(`Error in setValueWrapper for key "${key}": `, error);
    }
  }, [storedValue, key]); // Add key to dependencies of useCallback

  return [storedValue, setValueWrapper];
}
