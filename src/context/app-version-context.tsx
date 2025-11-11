"use client";

import { createContext, useContext } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';

export type AppVersion = 'current' | 'open-source';

export const APP_VERSION_STORAGE_KEY = 'aiTeleSuiteAppVersion';

interface AppVersionContextValue {
  appVersion: AppVersion;
  setAppVersion: (version: AppVersion) => void;
}

const AppVersionContext = createContext<AppVersionContextValue | undefined>(undefined);

export const versionOptions: Array<{
  value: AppVersion;
  label: string;
  description: string;
}> = [
  {
    value: 'current',
    label: 'Completely Working Version',
    description: 'Full experience with all AI integrations and managed services.',
  },
  {
    value: 'open-source',
    label: 'Free Open Source Version',
    description: 'Only free/open APIs & libraries. Paid integrations are disabled.',
  },
];

export function AppVersionProvider({ children }: { children: React.ReactNode }) {
  const [storedVersion, setStoredVersion] = useLocalStorage<AppVersion>(APP_VERSION_STORAGE_KEY, 'current');
  const value: AppVersionContextValue = {
    appVersion: storedVersion ?? 'current',
    setAppVersion: (next) => setStoredVersion(next),
  };
  return <AppVersionContext.Provider value={value}>{children}</AppVersionContext.Provider>;
}

export const useAppVersion = (): AppVersionContextValue => {
  const ctx = useContext(AppVersionContext);
  if (!ctx) {
    throw new Error('useAppVersion must be used within an AppVersionProvider');
  }
  return ctx;
};
