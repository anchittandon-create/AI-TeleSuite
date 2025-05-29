
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import type { UserProfile } from '@/types'; // This type should be just "Anchit"

// DEFAULT_PROFILE is "Anchit" as per the simplified UserProfile type
const DEFAULT_PROFILE: UserProfile = "Anchit";

interface UserProfileContextType {
  currentProfile: UserProfile;
  // No setCurrentProfile or availableProfiles as "Anchit" is the only, fixed profile
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  // The profile is now fixed to "Anchit".
  const currentProfile: UserProfile = DEFAULT_PROFILE;

  // useMemo is used here for consistency, though with a fixed profile, its benefits are minimal.
  const contextValue = useMemo(() => ({
    currentProfile,
  }), [currentProfile]); // currentProfile is constant, so memo is mainly for structure

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
