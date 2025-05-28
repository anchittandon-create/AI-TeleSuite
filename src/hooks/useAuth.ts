
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Agent, LoggedInAgent } from '@/types';

// Hardcoded agent data
export const PREDEFINED_AGENTS: Agent[] = [
  { id: 'guest', name: 'Guest', requiresPassword: false },
  { id: 'anchit', name: 'Anchit', requiresPassword: true, password: '2803' },
];

interface AuthContextType {
  loggedInAgent: LoggedInAgent | null;
  login: (agentId: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentLoggedInAgent, setCurrentLoggedInAgent] = useLocalStorage<LoggedInAgent | null>('loggedInAgent', null);
  const [authIsLoading, setAuthIsLoading] = useState(true);

  useEffect(() => {
    setAuthIsLoading(false);
  }, []);

  const login = useCallback(async (agentId: string, password?: string): Promise<boolean> => {
    setAuthIsLoading(true);
    const agent = PREDEFINED_AGENTS.find(a => a.id === agentId);

    if (!agent) {
      console.error("Login attempt for unknown agent ID:", agentId);
      setAuthIsLoading(false);
      return false;
    }

    if (agent.requiresPassword) {
      if (agent.password === password) {
        const agentToSave: LoggedInAgent = { id: agent.id, name: agent.name };
        setCurrentLoggedInAgent(agentToSave);
        setAuthIsLoading(false);
        return true;
      } else {
        console.error("Incorrect password for agent:", agentId);
        setAuthIsLoading(false);
        return false;
      }
    } else {
      const agentToSave: LoggedInAgent = { id: agent.id, name: agent.name };
      setCurrentLoggedInAgent(agentToSave);
      setAuthIsLoading(false);
      return true;
    }
  }, [setCurrentLoggedInAgent]);

  const logout = useCallback(() => {
    setAuthIsLoading(true);
    setCurrentLoggedInAgent(null);
    setAuthIsLoading(false);
  }, [setCurrentLoggedInAgent]);

  const contextValue = useMemo(() => ({
    loggedInAgent: currentLoggedInAgent,
    login,
    logout,
    isLoading: authIsLoading,
  }), [currentLoggedInAgent, login, logout, authIsLoading]);

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
