
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Agent, LoggedInAgent } from '@/types';
import { useRouter } from 'next/navigation';

const AUTH_STORAGE_KEY = 'aiTeleSuiteLoggedInAgent';

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
  const [storedAgent, setStoredAgent] = useLocalStorage<LoggedInAgent>(AUTH_STORAGE_KEY, null);
  const [loggedInAgentState, setLoggedInAgentState] = useState<LoggedInAgent>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (item) {
          const parsedAgent = JSON.parse(item) as LoggedInAgent;
           if (parsedAgent && typeof parsedAgent === 'object' && 'id' in parsedAgent && 'name' in parsedAgent) {
            setLoggedInAgentState(parsedAgent);
          } else if (parsedAgent === null) {
             setLoggedInAgentState(null);
          }
           else {
            console.warn("Invalid agent data in localStorage, clearing.");
            setLoggedInAgentState(null);
            window.localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } else {
          setLoggedInAgentState(null);
        }
      } catch (e) {
        console.error("Error parsing stored agent from localStorage:", e);
        setLoggedInAgentState(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
      setLoggedInAgentState(agentDataToStore);
      setStoredAgent(agentDataToStore);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error during login process:", error);
      setIsLoading(false);
      return false;
    }
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

export const PREDEFINED_AGENTS = AGENTS.map(a => ({ id: a.id, name: a.name, requiresPassword: !!a.requiresPassword }));
