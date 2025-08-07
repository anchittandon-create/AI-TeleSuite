
"use client";

import { useLocalStorage } from './use-local-storage';
import type { UserProfile } from '@/types';
import { useCallback } from 'react';

const USER_PROFILE_KEY = 'aiTeleSuiteActiveUserProfile';

interface UserProfileHookValue {
  currentProfile: UserProfile;
  setCurrentProfile: (profile: UserProfile) => void;
}

export const useUserProfile = (): UserProfileHookValue => {
  const [currentProfile, setCurrentProfileInternal] = useLocalStorage<UserProfile>(
    USER_PROFILE_KEY,
    "Anchit" // Default value
  );

  const setCurrentProfile = useCallback((profile: UserProfile) => {
    setCurrentProfileInternal(profile);
  }, [setCurrentProfileInternal]);

  return { currentProfile: currentProfile || "Anchit", setCurrentProfile };
};
