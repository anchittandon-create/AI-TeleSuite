
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Agent, LoggedInAgent } from '@/types';
import { useRouter } from 'next/navigation'; // Import useRouter

const AUTH_STORAGE_KEY = 'aiTeleSuiteLoggedInAgent';

// Define a basic Agent type, can be expanded later
const AGENTS: Agent[] = [
  { id: 'guest', name: 'Guest', requiresPassword: false },
  { id: 'anchit', name: 'Anchit', requiresPassword: true, password: '2803' },
  // Add other predefined agents here if needed
];

interface AuthContextType {
  loggedInAgent: LoggedInAgent;
  login: (agentIdOrName: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedInAgentState, setLoggedInAgentState] = useState<LoggedInAgent>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with true
  const [storedAgent, setStoredAgent] = useLocalStorage<LoggedInAgent>(AUTH_STORAGE_KEY, null);
  const router = useRouter(); // Initialize useRouter

  useEffect(() => {
    // This effect runs once on mount to sync loggedInAgentState with storedAgent.
    // useLocalStorage's own effect handles reading from localStorage.
    // We set isLoading to true initially and false after this sync.
    setIsLoading(true); // Explicitly set loading before potential async operations or checks
    if (storedAgent) {
      // Basic validation of the stored agent data
      if (typeof storedAgent === 'object' && storedAgent !== null && 'id' in storedAgent && 'name' in storedAgent) {
        setLoggedInAgentState(storedAgent);
      } else {
        // Invalid data found, clear it
        console.warn("Invalid agent data found in localStorage, clearing.");
        setLoggedInAgentState(null);
        setStoredAgent(null); // Also clear it from localStorage via the hook
      }
    } else {
      setLoggedInAgentState(null);
    }
    setIsLoading(false); // Set loading to false after initial setup
  }, [storedAgent, setStoredAgent]);


  const login = async (agentIdOrName: string, password?: string): Promise<boolean> => {
    setIsLoading(true); // Set loading true at the start of login
    try {
      const agentToLogin = AGENTS.find(a => a.id === agentIdOrName || a.name.toLowerCase() === agentIdOrName.toLowerCase());

      if (!agentToLogin) {
        console.error("Login Error: Agent not found for login attempt:", agentIdOrName);
        setIsLoading(false);
        return false; // Agent not found
      }

      // Check password if required
      if (agentToLogin.requiresPassword) {
        if (!password || password !== agentToLogin.password) {
          console.error("Login Error: Invalid password for agent:", agentToLogin.name);
          setIsLoading(false);
          return false; // Invalid password
        }
      }
      // If all checks pass
      const agentDataToStore: LoggedInAgent = { id: agentToLogin.id, name: agentToLogin.name };
      setLoggedInAgentState(agentDataToStore);
      setStoredAgent(agentDataToStore); // This will trigger localStorage update via useLocalStorage hook
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Login Error: An unexpected error occurred during login:", error);
      setIsLoading(false); // Ensure loading is set to false on error
      return false;
    }
  };

  const logout = () => {
    setIsLoading(true); // Set loading true at the start of logout
    setLoggedInAgentState(null);
    setStoredAgent(null); // This will trigger localStorage update
    // Redirect to login page
    // Ensure this only runs client-side if using Next.js 13+ App Router
    if (typeof window !== 'undefined') {
       router.push('/login');
    }
    setIsLoading(false); // Set loading false after logout operations
  };

  // Define contextValue to be passed to Provider
  const contextValue: AuthContextType = {
    loggedInAgent: loggedInAgentState,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export for login page to display available agents
export const PREDEFINED_AGENTS = AGENTS.map(a => ({ id: a.id, name: a.name, requiresPassword: !!a.requiresPassword }));
