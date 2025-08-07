
"use client";

import type { ActivityLogEntry, UserProfile, HistoricalScoreItem } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile'; // Simplified, always "Anchit"
import { useCallback } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
export const MAX_ACTIVITIES_TO_STORE = 50;

export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, () => []);
  const { currentProfile } = useUserProfile(); // This is now fixed to "Anchit" or "System User"

  const logActivity = useCallback((activityPayload: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>): string => {
    const newActivity: ActivityLogEntry = {
      ...activityPayload,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile,
    };
    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      const updatedActivities = [newActivity, ...currentItems];
      const finalActivities = updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
      return finalActivities;
    });
    return newActivity.id; // Return the ID of the newly created activity
  }, [setActivities, currentProfile]);

  const logBatchActivities = useCallback((activityPayloads: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[]) => {
    if (!activityPayloads || activityPayloads.length === 0) {
      return;
    }
    const newActivities: ActivityLogEntry[] = activityPayloads.map(payload => ({
      ...payload,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9) + payload.module, // Add module to ensure uniqueness if Date.now is same
      timestamp: new Date().toISOString(),
      agentName: currentProfile,
    }));

    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      const updatedActivities = [...newActivities.reverse(), ...currentItems]; // Add new ones to the start, preserving their batch order
      const finalActivities = updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
      return finalActivities;
    });
  }, [setActivities, currentProfile]);

  const updateActivity = useCallback((activityId: string, updatedDetails: Partial<HistoricalScoreItem['details']>) => {
    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      return currentItems.map(activity => {
        if (activity.id === activityId) {
          return {
            ...activity,
            details: {
              ...activity.details,
              ...updatedDetails,
            },
             // Update timestamp to reflect the update time, which helps with polling
            timestamp: new Date().toISOString()
          };
        }
        return activity;
      });
    });
  }, [setActivities]);


  return { activities: activities || [], logActivity, logBatchActivities, updateActivity, setActivities };
}

    