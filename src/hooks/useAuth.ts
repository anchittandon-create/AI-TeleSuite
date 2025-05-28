
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Agent, LoggedInAgent } from '@/types';
import { useRouter } from 'next/navigation';

const AUTH_STORAGE_KEY = 'aiTeleSuiteLoggedInAgent';

// Define a basic Agent type
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
  const [isLoading, setIsLoading] = useState(true);
  const [storedAgent, setStoredAgent] = useLocalStorage<LoggedInAgent>(AUTH_STORAGE_KEY, null);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    if (storedAgent) {
      // Basic validation for storedAgent structure
      if (typeof storedAgent === 'object' && storedAgent !== null && 'id' in storedAgent && 'name' in storedAgent) {
        setLoggedInAgentState(storedAgent);
      } else {
        console.warn("Invalid agent data found in localStorage, clearing.");
        setLoggedInAgentState(null);
        setStoredAgent(null); // Clear invalid data from localStorage
      }
    } else {
      setLoggedInAgentState(null);
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedAgent]); // Only re-run if storedAgent reference changes. setStoredAgent is stable.

  const login = async (agentIdOrName: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const agentToLogin = AGENTS.find(a => a.id === agentIdOrName || a.name.toLowerCase() === agentIdOrName.toLowerCase());

      if (!agentToLogin) {
        console.error("Login Error: Agent not found for login attempt:", agentIdOrName);
        setIsLoading(false);
        return false;
      }

      if (agentToLogin.requiresPassword) {
        if (!password || password !== agentToLogin.password) {
          console.error("Login Error: Invalid password for agent:", agentToLogin.name);
          setIsLoading(false);
          return false;
        }
      }
      // Ensure the object stored matches LoggedInAgent type (which allows null, but here we are storing a valid agent)
      const agentDataToStore: Extract<LoggedInAgent, object> = { id: agentToLogin.id, name: agentToLogin.name };
      setLoggedInAgentState(agentDataToStore);
      setStoredAgent(agentDataToStore);
    } catch (error) {
      console.error("Login Error: An unexpected error occurred during login:", error);
      setLoggedInAgentState(null);
      setStoredAgent(null);
      setIsLoading(false); // Ensure loading is set to false in catch block
      return false;
    }
    setIsLoading(false);
    return true;
  };

  const logout = () => {
    setIsLoading(true);
    setLoggedInAgentState(null);
    setStoredAgent(null);
    if (typeof window !== 'undefined') {
       router.push('/login');
    }
    setIsLoading(false);
  };

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

// Exporting PREDEFINED_AGENTS without passwords for use in UI, e.g., login form dropdown
export const PREDEFINED_AGENTS = AGENTS.map(a => ({ id: a.id, name: a.name, requiresPassword: !!a.requiresPassword }));
