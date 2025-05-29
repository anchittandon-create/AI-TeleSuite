
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { CallScoringDashboardTable } from '@/components/features/call-scoring-dashboard/dashboard-table';
import { ActivityLogEntry } from '@/types';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import { Skeleton } from '@/components/ui/skeleton';

export interface HistoricalScoreItem {
  id: string;
  timestamp: string;
  agentName?: string;
  product?: string;
  fileName: string;
  scoreOutput: ScoreCallOutput;
}

export default function CallScoringDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const scoredCallsHistory: HistoricalScoreItem[] = useMemo(() => {
    if (!isClient) return []; 
    return (activities || [])
      .filter(activity => 
        activity.module === "Call Scoring" && 
        activity.details && 
        typeof activity.details === 'object' && 
        'scoreOutput' in activity.details && 
        'fileName' in activity.details &&
        typeof (activity.details as any).fileName === 'string' && // Ensure fileName is string
        typeof (activity.details as any).scoreOutput === 'object' && // Ensure scoreOutput is object
        !('error' in activity.details) 
      )
      .map(activity => {
        const details = activity.details as { fileName: string, scoreOutput: ScoreCallOutput };
        return {
          id: activity.id,
          timestamp: activity.timestamp,
          agentName: activity.agentName,
          product: activity.product,
          fileName: details.fileName,
          scoreOutput: details.scoreOutput,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Call Scoring Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {isClient ? (
          <CallScoringDashboardTable key={`scoring-dashboard-table-${(scoredCallsHistory || []).length}`} history={scoredCallsHistory} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of the most recent {MAX_ACTIVITIES_TO_STORE} successfully scored calls. Audio playback/download is not available for historical entries as audio data is not stored in the activity log to save space.
        </div>
      </main>
    </div>
  );
}
