
"use client";

import { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile'; 

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
const MAX_ACTIVITIES_TO_STORE = 50; // Limit the number of activities

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  const { currentProfile } = useUserProfile(); 

  const logActivity = (activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile, 
    };
    setActivities(prevActivities => 
      [newActivity, ...prevActivities].slice(0, MAX_ACTIVITIES_TO_STORE)
    );
  };

  return { activities, logActivity, setActivities };
}
