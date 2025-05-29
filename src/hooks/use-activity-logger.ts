
"use client";

import { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile'; // Import useUserProfile

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  const { currentProfile } = useUserProfile(); // Get currentProfile

  const logActivity = (activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile || 'System User', // Use currentProfile or default
    };
    setActivities(prevActivities => [newActivity, ...prevActivities]);
  };

  return { activities, logActivity, setActivities };
}
