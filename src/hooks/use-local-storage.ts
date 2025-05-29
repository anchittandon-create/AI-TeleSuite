
"use client";

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValueProp: T | (() => T)): [T, SetValue<T>] {
  // Function to resolve the initial value, whether it's a direct value or a function
  const resolveInitialValue = useCallback((): T => {
    return typeof initialValueProp === 'function'
      ? (initialValueProp as () => T)()
      : initialValueProp;
  }, [initialValueProp]);

  const [storedValue, setStoredValue] = useState<T>(() => {
    // This initializer runs only once.
    // On the server, and first client render before useEffect, it uses the resolved initial value.
    return resolveInitialValue();
  });

  // Effect to load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      } else {
        // If no item exists, but initialValueProp might have been a function that
        // should be evaluated and stored (e.g. if it's not just a simple empty array)
        // The current storedValue is already the resolvedInitialValue from useState.
        // So the write effect below will persist it.
        // However, if we want to be explicit about storing the *resolved* initial value
        // when the key is not found:
        window.localStorage.setItem(key, JSON.stringify(resolveInitialValue()));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}" during mount: `, error);
      // Attempt to recover by removing the potentially corrupted key and setting initialValue
      try {
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, JSON.stringify(resolveInitialValue()));
        // No need to setStoredValue here as it's already the initial value from useState
      } catch (recoveryError) {
        console.error(`Failed to recover localStorage for key "${key}": `, recoveryError);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run if key changes. initialValueProp is captured by resolveInitialValue.

  // Effect to update localStorage when storedValue changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // To prevent writing the initial resolved value if it was just set by useState
    // and localStorage was empty, we could add a check. However, it's generally
    // simpler and safer to always write the current state.
    // If storedValue IS the initialValue because localStorage was empty or unparseable,
    // this ensures the initialValue gets written to localStorage.
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}": `, error);
    }
  }, [key, storedValue]);

  const setValue: SetValue<T> = useCallback(
    (value) => {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
    },
    [storedValue] // Include storedValue as dependency if value can be a function `(val: T) => T`
  );

  return [storedValue, setValue];
}
