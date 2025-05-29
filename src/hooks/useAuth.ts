
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import type { LoggedInAgent } from '@/types'; // Ensure LoggedInAgent type is correctly imported
import { useLocalStorage } from './use-local-storage';

const AUTH_KEY = 'aiTeleSuiteLoggedInAgent';

// Define Agent type locally to minimize cross-file issues for this problematic file
interface Agent {
  id: string;
  name: string;
  requiresPassword?: boolean;
  password?: string; // Password is a string
}

// Define these directly in the hook file
export const PREDEFINED_AGENTS: Agent[] = [
  { id: 'guest', name: 'Guest' },
  { id: 'anchit', name: 'Anchit', password: 'Anchit', requiresPassword: true },
];

interface AuthContextType {
  loggedInAgent: LoggedInAgent | null;
  login: (agentId: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loggedInAgent, setLoggedInAgent] = useLocalStorage<LoggedInAgent | null>(AUTH_KEY, null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const login = useCallback(async (agentId: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    const agent = PREDEFINED_AGENTS.find(a => a.id === agentId);
    if (agent) {
      if (agent.requiresPassword) {
        if (agent.password === password) {
          const agentToSave: LoggedInAgent = { id: agent.id, name: agent.name };
          setLoggedInAgent(agentToSave);
          setIsLoading(false);
          return true;
        } else {
          console.error("Login failed: Invalid password for agent:", agent.name);
          setIsLoading(false);
          return false;
        }
      } else {
        const agentToSave: LoggedInAgent = { id: agent.id, name: agent.name };
        setLoggedInAgent(agentToSave);
        setIsLoading(false);
        return true;
      }
    }
    console.error("Login failed: Agent not found with ID:", agentId);
    setIsLoading(false);
    return false;
  }, [setLoggedInAgent]);

  const logout = useCallback(() => {
    setIsLoading(true);
    setLoggedInAgent(null);
    setIsLoading(false);
  }, [setLoggedInAgent]);

  const contextValue = useMemo(() => ({
    loggedInAgent,
    login,
    logout,
    isLoading
  }), [loggedInAgent, login, logout, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
