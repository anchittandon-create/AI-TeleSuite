
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger } from '@/hooks/use-activity-logger';
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

const MAX_ACTIVITIES_TO_STORE = 50; // To display in the note, consistent with logger

export default function CallScoringDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // useEffect(() => {
  //   if (isClient) {
  //     console.log("CallScoringDashboardPage: activities received:", activities);
  //   }
  // }, [activities, isClient]);

  const scoredCallsHistory: HistoricalScoreItem[] = useMemo(() => {
    if (!isClient) return []; 
    // console.log("CallScoringDashboardPage: Filtering activities. Count:", (activities || []).length);
    return (activities || [])
      .filter(activity => 
        activity.module === "Call Scoring" && 
        activity.details && 
        typeof activity.details === 'object' && 
        'scoreOutput' in activity.details && 
        'fileName' in activity.details &&
        !('error' in activity.details) // Only show successfully scored calls
      )
      .map(activity => {
        // Type assertion is safe here due to the filter above
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
          This dashboard displays a history of the most recent {MAX_ACTIVITIES_TO_STORE} successfully scored calls. Audio playback is not available for historical entries.
        </div>
      </main>
    </div>
  );
}
