
"use client";

import type { ActivityLogEntry } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useUserProfile } from './useUserProfile';
import { useCallback, createContext, useContext, ReactNode } from 'react';

const ACTIVITY_LOG_KEY = 'aiTeleSuiteActivityLog';
export const MAX_ACTIVITIES_TO_STORE = 50;

// Helper to remove large, non-essential data from details before saving to localStorage
const stripLargePayloads = (details: ActivityLogEntry['details']): ActivityLogEntry['details'] => {
    if (typeof details !== 'object' || details === null) {
        return details;
    }

    const newDetails: Record<string, unknown> = { ...(details as Record<string, unknown>) };

    // The activity log should not store the full audio data URI.
    if ('audioDataUri' in newDetails) {
        delete newDetails.audioDataUri;
    }
    
    // For voice agent calls, do not store the full conversation history.
    if ('fullConversation' in newDetails) {
        delete newDetails.fullConversation;
    }

    // For material generation, the content can be huge. We store the input and title.
    if (typeof newDetails.materialOutput === 'object' && newDetails.materialOutput !== null && 'sections' in newDetails.materialOutput) {
        const materialOutput = newDetails.materialOutput as Record<string, unknown>;
        const sections = Array.isArray(materialOutput.sections) ? materialOutput.sections : [];
        newDetails.materialOutput = {
            deckTitle: materialOutput.deckTitle,
            sections: [{ title: `(Content for ${sections.length} sections is not stored in log)`, content: "" }]
        };
    }

    return newDetails;
};

interface ActivityLogContextType {
  activities: ActivityLogEntry[];
  logActivity: (activityPayload: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>) => string;
  logBatchActivities: (activityPayloads: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[]) => void;
  updateActivity: (activityId: string, updatedDetails: Partial<ActivityLogEntry['details']>) => void;
  deleteActivities: (activityIds: string[]) => void;
  clearAllActivities: () => void;
  setActivities: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export const ActivityLogProvider = ({ children }: { children: ReactNode }) => {
    const [activities, setActivities] = useLocalStorage<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
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

    const value = { activities: activities || [], logActivity, logBatchActivities, updateActivity, deleteActivities, clearAllActivities, setActivities };
    
    return <ActivityLogContext.Provider value={value}>{children}</ActivityLogContext.Provider>;
};


export const useActivityLogger = (): ActivityLogContextType => {
  const context = useContext(ActivityLogContext);
  if (context === undefined) {
    throw new Error('useActivityLogger must be used within an ActivityLogProvider');
  }
  return context;
};
