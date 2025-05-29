
"use client";

import type { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile';
import { useCallback } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
const MAX_ACTIVITIES_TO_STORE = 50; // Limit the number of activities

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, () => []);
  const { currentProfile } = useUserProfile(); // This is "Anchit"

  const logActivity = useCallback((activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    // console.log("logActivity called with:", activity, "Current profile:", currentProfile);
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile, 
    };
    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      const updatedActivities = [newActivity, ...currentItems];
      const finalActivities = updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
      // console.log("Current activities after update in logActivity:", finalActivities.length, "items. First item ID:", finalActivities[0]?.id);
      return finalActivities;
    });
  }, [setActivities, currentProfile]);

  return { activities: activities || [], logActivity, setActivities };
}
