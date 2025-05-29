
"use client";

import type { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile';
import { useCallback } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
const MAX_ACTIVITIES_TO_STORE = 50; // Limit the number of activities

export function useActivityLogger() {
  // Pass the initial value directly. useLocalStorage will handle initializing from storage.
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  const { currentProfile } = useUserProfile();

  const logActivity = useCallback((activity: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile, // This is "Anchit"
    };
    setActivities(prevActivities => {
      const updatedActivities = [newActivity, ...(prevActivities || [])];
      return updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
    });
  }, [setActivities, currentProfile]);

  // Ensure activities is always an array for consumers, even if useLocalStorage temporarily returns undefined during init.
  return { activities: activities || [], logActivity, setActivities };
}
