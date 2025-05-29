
"use client";

// This file is intentionally simplified to remove the profile system
// and the React Context Provider due to persistent parsing errors.
// The application will now operate under a default "System User" context
// provided directly by the useUserProfile hook.

import type { ReactNode } from 'react'; // ReactNode might not be needed anymore if Provider is gone
import type { UserProfile } from '@/types';

interface UserProfileContextType {
  currentProfile: UserProfile;
}

// No more Context or Provider

export const useUserProfile = (): UserProfileContextType => {
  // Always return "System User" as the profile.
  // This hook no longer relies on localStorage or context for profile management.
  return { currentProfile: "System User" };
};
