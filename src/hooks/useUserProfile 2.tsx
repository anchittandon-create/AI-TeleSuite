"use client";

import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types';
import { createContext, useCallback, useContext, ReactNode } from 'react';

const USER_PROFILE_KEY = 'aiTeleSuiteActiveUserProfile';

interface UserProfileContextType {
  currentProfile: UserProfile;
  setCurrentProfile: (profile: UserProfile) => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);


export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [currentProfile, setCurrentProfileInternal] = useLocalStorage<UserProfile>(
    USER_PROFILE_KEY,
    "Anchit" // Default value
  );

  const setCurrentProfile = useCallback((profile: UserProfile) => {
    setCurrentProfileInternal(profile);
  }, [setCurrentProfileInternal]);
  
  const value = { currentProfile: currentProfile || "Anchit", setCurrentProfile };

  return (
    <UserProfileContext.Provider value={value}>
        {children}
    </UserProfileContext.Provider>
  );
};


export const useUserProfile = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
