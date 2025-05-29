
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import type { UserProfile } from '@/types';

const DEFAULT_PROFILE: UserProfile = "Anchit";

interface UserProfileContextType {
  currentProfile: UserProfile;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  // The profile is now fixed to "Anchit".
  const currentProfile: UserProfile = DEFAULT_PROFILE;

  // useMemo is used here for consistency, though with a fixed profile, its benefits are minimal.
  const contextValue = useMemo(() => ({
    currentProfile,
  }), [currentProfile]); // Dependency array includes currentProfile for correctness, though it's constant.

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
