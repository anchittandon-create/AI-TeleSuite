
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Agent, LoggedInAgent } from '@/types';
import { useRouter } from 'next/navigation';

const AUTH_STORAGE_KEY = 'aiTeleSuiteLoggedInAgent';

const AGENTS: Agent[] = [
  { id: 'guest', name: 'Guest', requiresPassword: false },
  { id: 'anchit', name: 'Anchit', requiresPassword: true, password: '2803' },
];

interface AuthContextType {
  loggedInAgent: LoggedInAgent;
  login: (agentIdOrName: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storedAgent, setStoredAgent] = useLocalStorage<LoggedInAgent>(AUTH_STORAGE_KEY, null);
  const [loggedInAgent, setLoggedInAgent] = useState<LoggedInAgent>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true, set to false after initial check
  const router = useRouter();

  useEffect(() => {
    // Sync state from localStorage on initial mount
    if (storedAgent) {
      setLoggedInAgent(storedAgent);
    }
    setIsLoading(false); // Done with initial load from localStorage
  }, [storedAgent]);

  const login = async (agentIdOrName: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const agentToLogin = AGENTS.find(a => a.id === agentIdOrName || a.name.toLowerCase() === agentIdOrName.toLowerCase());

      if (!agentToLogin) {
        console.error("Agent not found for login attempt:", agentIdOrName);
        setIsLoading(false);
        return false;
      }

      if (agentToLogin.requiresPassword) {
        if (!password || password !== agentToLogin.password) {
          console.error("Invalid password for agent:", agentToLogin.name);
          setIsLoading(false);
          return false;
        }
      }

      const agentDataToStore: LoggedInAgent = { id: agentToLogin.id, name: agentToLogin.name };
      setLoggedInAgent(agentDataToStore);
      setStoredAgent(agentDataToStore); // This will update localStorage & trigger the useEffect above
      return true;
    } catch (error) {
      console.error("Error during login process:", error);
      return false; // Ensure false is returned on unexpected error
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsLoading(true);
    setLoggedInAgent(null);
    setStoredAgent(null); // This will clear localStorage & trigger the useEffect above
    // The useEffect on storedAgent will set isLoading to false after this.
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ loggedInAgent, login, logout, isLoading }}>
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

export const PREDEFINED_AGENTS = AGENTS.map(a => ({id: a.id, name: a.name, requiresPassword: !!a.requiresPassword}));
