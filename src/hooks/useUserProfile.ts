
"use client";

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types';
import { USER_PROFILES } from '@/types';

const USER_PROFILE_KEY = 'aiTeleSuiteCurrentProfile';
const DEFAULT_PROFILE: UserProfile = "Anchit"; // Explicitly set Anchit as the default

interface UserProfileContextType {
  currentProfile: UserProfile;
  setCurrentProfile: (profile: UserProfile) => void;
  availableProfiles: UserProfile[];
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [currentProfileLS, setCurrentProfileLS] = useLocalStorage<UserProfile>(
    USER_PROFILE_KEY,
    DEFAULT_PROFILE // Use Anchit as the initial default for localStorage
  );

  // Ensure currentProfile is always a valid profile from the predefined list
  const validatedProfile = USER_PROFILES.includes(currentProfileLS)
    ? currentProfileLS
    : DEFAULT_PROFILE; // Fallback to Anchit if localStorage value is invalid

  const setCurrentProfile = useCallback((profile: UserProfile) => {
    if (USER_PROFILES.includes(profile)) {
      setCurrentProfileLS(profile);
    } else {
      console.warn(`Attempted to set invalid profile: ${profile}. Defaulting to ${DEFAULT_PROFILE}.`);
      setCurrentProfileLS(DEFAULT_PROFILE); // Fallback to Anchit on invalid set
    }
  }, [setCurrentProfileLS]);

  const contextValue = useMemo(() => ({
    currentProfile: validatedProfile,
    setCurrentProfile,
    availableProfiles: USER_PROFILES,
  }), [validatedProfile, setCurrentProfile]);

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
