"use client";

import { useLocalStorage } from './use-local-storage';

const AGENT_NAME_KEY = 'pitchPerfectAgentName';

export function useAgentName(): [string, (name: string) => void] {
  const [agentName, setAgentName] = useLocalStorage<string>(AGENT_NAME_KEY, '');
  return [agentName, setAgentName];
}
