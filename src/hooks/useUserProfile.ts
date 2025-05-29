
"use client";

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types'; // Ensure this path is correct
import { USER_PROFILES } from '@/types'; // Ensure this path is correct

const USER_PROFILE_KEY = 'aiTeleSuiteCurrentProfile';
const DEFAULT_PROFILE: UserProfile = "Anchit"; // Anchit as the primary default

interface UserProfileContextType {
  currentProfile: UserProfile;
  setCurrentProfile: (profile: UserProfile) => void;
  availableProfiles: UserProfile[];
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [currentProfileLS, setCurrentProfileLS] = useLocalStorage<UserProfile>(
    USER_PROFILE_KEY,
    DEFAULT_PROFILE // Initialize localStorage hook with Anchit as default
  );

  // Validate the profile loaded from localStorage, defaulting to Anchit if invalid or not found
  const validatedProfile = useMemo(() => {
    if (USER_PROFILES.includes(currentProfileLS)) {
      return currentProfileLS;
    }
    // If the value from localStorage is not in USER_PROFILES, default to Anchit
    // This also handles the initial case where localStorage might be empty or contain an old value
    return DEFAULT_PROFILE;
  }, [currentProfileLS]);

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
