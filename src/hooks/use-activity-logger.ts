
"use client";

import { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useAuth } from './useAuth'; // Import useAuth

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog'; // Updated key for new app name

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  const { loggedInAgent } = useAuth(); // Get loggedInAgent from useAuth

  const logActivity = (activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: loggedInAgent?.name || 'Unknown', // Use loggedInAgent's name
    };
    setActivities(prevActivities => [newActivity, ...prevActivities]);
  };

  return { activities, logActivity, setActivities };
}
