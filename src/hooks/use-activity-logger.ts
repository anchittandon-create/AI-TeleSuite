
"use client";

import { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
// import { useAuth } from './useAuth'; // useAuth import removed

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  // const { loggedInAgent } = useAuth(); // loggedInAgent removed

  const logActivity = (activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: 'System User', // Default to 'System User' as login is removed
    };
    setActivities(prevActivities => [newActivity, ...prevActivities]);
  };

  return { activities, logActivity, setActivities };
}
