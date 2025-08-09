
"use client";

import type { ActivityLogEntry, UserProfile, HistoricalScoreItem } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile'; // Simplified, always "Anchit"
import { useCallback } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
export const MAX_ACTIVITIES_TO_STORE = 50;

// Helper to remove large, non-essential data from details before saving to localStorage
const stripLargePayloads = (details: any): any => {
    if (typeof details !== 'object' || details === null) {
        return details;
    }

    const newDetails = { ...details };

    // Remove large, dynamically generated data that doesn't need to persist in the log
    if ('fullCallAudioDataUri' in newDetails) {
        delete newDetails.fullCallAudioDataUri;
    }
    // The score output can be very large, and the most important parts (score, category) are often
    // logged at a higher level or can be regenerated. Let's strip it from the persisted log.
    if ('scoreOutput' in newDetails) {
        // We might want to keep a summary, but for now, let's remove the whole thing to be safe.
        delete newDetails.scoreOutput;
    }
     if ('finalScore' in newDetails) {
        delete newDetails.finalScore;
    }


    return newDetails;
};


export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, () => []);
  const { currentProfile } = useUserProfile(); // This is now fixed to "Anchit" or "System User"

  const logActivity = useCallback((activityPayload: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>): string => {
    const newActivity: ActivityLogEntry = {
      ...activityPayload,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile,
      // Strip large payloads from the initial log as well
      details: stripLargePayloads(activityPayload.details),
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
      details: stripLargePayloads(payload.details),
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
          // IMPORTANT: Before saving, strip out any large data that shouldn't be persisted.
          const strippedUpdatedDetails = stripLargePayloads(updatedDetails);
          return {
            ...activity,
            details: {
              ...activity.details,
              ...strippedUpdatedDetails,
            },
             // We don't update timestamp anymore, as it could cause re-ordering issues.
             // The original timestamp should be preserved.
          };
        }
        return activity;
      });
    });
  }, [setActivities]);


  return { activities: activities || [], logActivity, logBatchActivities, updateActivity, setActivities };
}
