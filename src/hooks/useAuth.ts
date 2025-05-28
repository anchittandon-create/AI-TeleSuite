
"use client";

// This file's functionality has been temporarily disabled due to persistent parsing errors
// and to unblock development. Authentication features can be re-added later.

import type { ReactNode } from 'react';

// Minimal types to satisfy potential imports if not all are caught
// These are now also removed from src/types/index.ts, but kept here as a failsafe
// for any lingering direct imports to this file.
interface DummyAgent { id: string; name: string; requiresPassword?: boolean; password?: string; }
type DummyLoggedInAgent = { id: string; name: string; } | null;

export const PREDEFINED_AGENTS: DummyAgent[] = [];

export const useAuth = () => {
  // console.warn("useAuth hook is currently disabled. Returning dummy values.");
  return {
    loggedInAgent: null as DummyLoggedInAgent,
    login: async (_agentId: string, _password?: string): Promise<boolean> => {
      console.warn("Login functionality is currently disabled. Proceeding without authentication.");
      // To allow access to the app, we can simulate a successful "guest" login here
      // or simply let the app proceed. Since the main layout won't check auth, this is okay.
      return true; 
    },
    logout: () => {
      console.warn("Logout functionality is currently disabled.");
    },
    isLoading: false,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // console.warn("AuthProvider functionality is currently disabled. Rendering children directly.");
  return <>{children}</>;
};
