
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
            return item ? JSON.parse(item) : (typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp);
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return typeof initialValueProp === 'function' ? (initialValueProp as () => T)() : initialValueProp;
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
