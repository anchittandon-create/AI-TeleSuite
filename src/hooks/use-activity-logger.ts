"use client";

import { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useAgentName } from './use-agent-name';

const ACTIVITY_LOG_KEY = 'pitchPerfectActivityLog';

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  const [currentAgentName] = useAgentName();

  const logActivity = (activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentAgentName || 'Unknown',
    };
    setActivities(prevActivities => [newActivity, ...prevActivities]);
  };

  return { activities, logActivity, setActivities };
}
