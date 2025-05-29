
"use client";

// This file is intentionally simplified to ensure a fixed "Anchit" profile
// and avoid React Context Provider issues that caused persistent parsing errors.
// The application will operate under this default "Anchit" context.

import type { UserProfile } from '@/types';

interface UserProfileHookValue {
  currentProfile: UserProfile;
  // No setCurrentProfile or availableProfiles as it's fixed
}

export const useUserProfile = (): UserProfileHookValue => {
  // Always return "Anchit" as the profile.
  // This hook no longer relies on localStorage or context for profile management.
  return { currentProfile: "Anchit" };
};
