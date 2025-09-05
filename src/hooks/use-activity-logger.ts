
"use client";

import type { ActivityLogEntry, UserProfile, ScoreCallOutput } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile'; 
import { useCallback } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
export const MAX_ACTIVITIES_TO_STORE = 50;

// Helper to remove large, non-essential data from details before saving to localStorage
const stripLargePayloads = (details: any): any => {
    if (typeof details !== 'object' || details === null) {
        return details;
    }

    const newDetails = { ...details };

    // The user has the original file, and the dashboard is for reviewing the *analysis*.
    if ('audioDataUri' in newDetails) {
        delete newDetails.audioDataUri;
    }
    
    // This is now handled by the voice agent flows before logging.
    // if ('fullCallAudioDataUri' in newDetails) {
    //     delete newDetails.fullCallAudioDataUri;
    // }

    // In scoreOutput, the full transcript is the largest part and can be derived.
    if (newDetails.scoreOutput && typeof newDetails.scoreOutput === 'object' && 'transcript' in newDetails.scoreOutput) {
        // keep transcript for review
    }
    
    if (newDetails.finalScore && typeof newDetails.finalScore === 'object' && 'transcript' in newDetails.finalScore) {
        // keep transcript for review
    }

    // Full conversation logs can also be very large.
    if ('fullConversation' in newDetails) {
      // keep full conversation for review
    }
    
    // For material generation, the content can be huge. We store the input and title.
    if (newDetails.materialOutput && typeof newDetails.materialOutput === 'object' && 'sections' in newDetails.materialOutput) {
        newDetails.materialOutput = {
            deckTitle: newDetails.materialOutput.deckTitle,
            sections: [{title: `(Content for ${newDetails.materialOutput.sections.length} sections is not stored in log)`, content: "" }]
        };
    }

    return newDetails;
};


export function useActivityLogger() {
  const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, () => []);
  const { currentProfile } = useUserProfile(); 

  const logActivity = useCallback((activityPayload: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>): string => {
    const newActivity: ActivityLogEntry = {
      ...activityPayload,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9),
      timestamp: new Date().toISOString(),
      agentName: currentProfile,
      details: stripLargePayloads(activityPayload.details),
    };
    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      const updatedActivities = [newActivity, ...currentItems];
      return updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
    });
    return newActivity.id; 
  }, [setActivities, currentProfile]);

  const logBatchActivities = useCallback((activityPayloads: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[]) => {
    if (!activityPayloads || activityPayloads.length === 0) {
      return;
    }
    const newActivities: ActivityLogEntry[] = activityPayloads.map(payload => ({
      ...payload,
      id: Date.now().toString() + Math.random().toString(36).substring(2,9) + (payload.details?.fileName || payload.module), 
      timestamp: new Date().toISOString(),
      agentName: currentProfile,
      details: stripLargePayloads(payload.details),
    }));

    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      const updatedActivities = [...newActivities.reverse(), ...currentItems]; 
      return updatedActivities.slice(0, MAX_ACTIVITIES_TO_STORE);
    });
  }, [setActivities, currentProfile]);

  const updateActivity = useCallback((activityId: string, updatedDetails: Partial<ActivityLogEntry['details']>) => {
    setActivities(prevActivities => {
      const currentItems = prevActivities || [];
      return currentItems.map(activity => {
        if (activity.id === activityId) {
          const newDetails = {
              ...activity.details,
              ...updatedDetails,
            };
          return {
            ...activity,
            details: stripLargePayloads(newDetails),
          };
        }
        return activity;
      });
    });
  }, [setActivities]);

  const deleteActivities = useCallback((activityIds: string[]) => {
    setActivities(prev => (prev || []).filter(activity => !activityIds.includes(activity.id)));
  }, [setActivities]);
  
  const clearAllActivities = useCallback(() => {
    setActivities([]);
  }, [setActivities]);


  return { activities: activities || [], logActivity, logBatchActivities, updateActivity, deleteActivities, clearAllActivities, setActivities };
}
