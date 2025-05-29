
"use client";

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    // This part runs only on initial render on the client *if* window is defined.
    // For SSR, window will be undefined, and initialValue will be returned.
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      if (item) {
        return JSON.parse(item);
      } else {
        // If no item exists, set the initial value in localStorage
        window.localStorage.setItem(key, JSON.stringify(initialValue));
        return initialValue;
      }
    } catch (error) {
      // If error reading or parsing, log it and return initialValue
      // console.error(`Error reading localStorage key "${key}" during initialization: `, error);
      // Attempt to recover by removing the potentially corrupted key and setting initialValue
      try {
        // console.warn(`Attempting to clear corrupted key "${key}" from localStorage.`);
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, JSON.stringify(initialValue));
      } catch (recoveryError) {
        // console.error(`Failed to recover localStorage for key "${key}": `, recoveryError);
      }
      return initialValue;
    }
  });

  // useEffect to update localStorage when the storedValue state changes
  useEffect(() => {
    // This effect should only run on the client
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      // console.error(`Error setting localStorage key "${key}": `, error);
    }
  }, [key, storedValue]);


  // The setValue function now simply updates the React state.
  // The useEffect above will handle persisting it to localStorage.
  const setValueWrapper = useCallback((value: T | ((val: T) => T)) => {
    // Allow value to be a function so we have same API as useState
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    // The try...catch block that was previously here (around lines 66-68 from your error)
    // has been removed. setStoredValue is a React state setter and is unlikely to throw here.
    // The actual localStorage.setItem is handled by the useEffect hook above.
  }, [storedValue, key]); // Add key to dependencies of useCallback for completeness, though storedValue is primary.

  return [storedValue, setValueWrapper];
}
