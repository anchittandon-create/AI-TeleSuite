
"use client";

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types';
import { USER_PROFILES } from '@/types';

const USER_PROFILE_KEY = 'aiTeleSuiteCurrentProfile';

interface UserProfileContextType {
  currentProfile: UserProfile;
  setCurrentProfile: (profile: UserProfile) => void;
  availableProfiles: UserProfile[];
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [currentProfile, setCurrentProfileState] = useLocalStorage<UserProfile>(USER_PROFILE_KEY, USER_PROFILES[0]);

  const setCurrentProfile = useCallback((profile: UserProfile) => {
    if (USER_PROFILES.includes(profile)) {
      setCurrentProfileState(profile);
    } else {
      console.warn(`Attempted to set invalid profile: ${profile}. Defaulting to ${USER_PROFILES[0]}.`);
      setCurrentProfileState(USER_PROFILES[0]);
    }
  }, [setCurrentProfileState]);

  const contextValue = useMemo(() => ({
    currentProfile,
    setCurrentProfile,
    availableProfiles: USER_PROFILES,
  }), [currentProfile, setCurrentProfile]);

  return (
    <UserProfileContext.Provider value={contextValue}>
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
