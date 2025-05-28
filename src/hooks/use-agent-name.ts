
"use client";

// This hook is now largely superseded by useAuth for identifying the current agent.
// It's kept for potential other uses or if a non-authenticated agent name input is needed elsewhere.
// For current agent identification in features like activity logging, useAuth should be preferred.

import { useLocalStorage } from './use-local-storage';

const AGENT_NAME_KEY = 'aiTeleSuiteAgentName_deprecated'; // Key changed to avoid conflict with old data

export function useAgentName(): [string, (name: string) => void] {
  const [agentName, setAgentName] = useLocalStorage<string>(AGENT_NAME_KEY, '');
  return [agentName, setAgentName];
}
