
"use client";

import { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useAuth } from './useAuth'; // useAuth import re-added

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  const { loggedInAgent } = useAuth(); // loggedInAgent re-added

  const logActivity = (activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: loggedInAgent?.name || 'System User', // Use logged-in agent name or default
    };
    setActivities(prevActivities => [newActivity, ...prevActivities]);
  };

  return { activities, logActivity, setActivities };
}
