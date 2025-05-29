
"use client";

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValueProp: T | (() => T)): [T, SetValue<T>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // This function (initializer for useState) runs only once on initial render.
    if (typeof window === 'undefined') {
      // Server-side rendering or build time
      // console.log(`useLocalStorage (${key}): SSR, returning initialValueProp.`);
      return typeof initialValueProp === 'function'
        ? (initialValueProp as () => T)()
        : initialValueProp;
    }
    try {
      // console.log(`useLocalStorage (${key}): Client-side initial read attempt.`);
      const item = window.localStorage.getItem(key);
      if (item) {
        // console.log(`useLocalStorage (${key}): Found item in localStorage:`, item.substring(0,100) + "...");
        return JSON.parse(item);
      } else {
        // console.log(`useLocalStorage (${key}): No item in localStorage, setting initial value.`);
        const initial = typeof initialValueProp === 'function'
          ? (initialValueProp as () => T)()
          : initialValueProp;
        window.localStorage.setItem(key, JSON.stringify(initial));
        return initial;
      }
    } catch (error) {
      console.warn(`useLocalStorage (${key}): Error reading localStorage during initial render. Falling back to initial value. Error:`, error);
      const initial = typeof initialValueProp === 'function'
        ? (initialValueProp as () => T)()
        : initialValueProp;
      try {
        console.warn(`useLocalStorage (${key}): Attempting to clear potentially corrupted key and set initial value.`);
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, JSON.stringify(initial));
      } catch (recoveryError) {
        console.error(`useLocalStorage (${key}): Failed to recover localStorage during initial render:`, recoveryError);
      }
      return initial;
    }
  });

  // Effect to update localStorage when storedValue changes (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // console.log(`useLocalStorage (${key}): storedValue changed, attempting to write to localStorage:`, typeof storedValue === 'string' ? storedValue.substring(0,100) + "..." : storedValue);
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
      // console.log(`useLocalStorage (${key}): Successfully wrote to localStorage.`);
    } catch (error) {
      console.error(`useLocalStorage (${key}): Error setting localStorage: `, error);
    }
  }, [key, storedValue]);

  const setValue: SetValue<T> = useCallback(
    (value) => {
      try {
        // console.log(`useLocalStorage (${key}): setValue called.`);
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
      } catch (error) {
        console.error(`useLocalStorage (${key}): Error in setValue function: `, error);
      }
    },
    [key, storedValue] // Include key and storedValue for stability of the callback if it's used in deps array
  );

  return [storedValue, setValue];
}
