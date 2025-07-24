
"use client";

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

// A more stable version of SetValue to avoid re-renders.
type SetValue<T> = Dispatch<SetStateAction<T>>;

export function useLocalStorage<T>(key: string, initialValueProp: T | (() => T)): [T, SetValue<T>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp;
        }
        try {
            const item = window.localStorage.getItem(key);
            if (item) {
                return JSON.parse(item);
            }
            // If no item, compute initial value and set it in localStorage
            const initialValue = typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp;
            window.localStorage.setItem(key, JSON.stringify(initialValue));
            return initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            const initialValue = typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp;
            return initialValue;
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(key, JSON.stringify(storedValue));
            } catch (error) {
                console.error(`Error setting localStorage key “${key}”:`, error);
            }
        }
    }, [key, storedValue]);
    
    // The setter function `setStoredValue` from `useState` is stable by default.
    // We can just return it directly.
    return [storedValue, setStoredValue];
}
