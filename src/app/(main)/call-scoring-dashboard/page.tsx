
"use client";

import { useState, useMemo } from 'react';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { CallScoringDashboardTable } from '@/components/features/call-scoring-dashboard/dashboard-table';
import { ActivityLogEntry } from '@/types';
import { ScoreCallOutput } from '@/ai/flows/call-scoring';

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

  const scoredCallsHistory: HistoricalScoreItem[] = useMemo(() => {
    return activities
      .filter(activity => 
        activity.module === "Call Scoring" && 
        activity.details && 
        typeof activity.details === 'object' && 
        'scoreOutput' in activity.details && 
        'fileName' in activity.details
      )
      .map(activity => {
        const details = activity.details as { fileName: string, scoreOutput: ScoreCallOutput, error?: string };
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
  }, [activities]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Call Scoring Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Filters can be added here later if needed */}
        <CallScoringDashboardTable history={scoredCallsHistory} />
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of all calls analyzed by the AI Call Scoring feature. Audio playback is not available for historical entries.
        </div>
      </main>
    </div>
  );
}
