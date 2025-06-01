
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisDashboardTable } from '@/components/features/data-analysis-dashboard/dashboard-table'; // Uses updated table
import type { ActivityLogEntry } from '@/types';
import type { DataAnalysisStrategyOutput, DataAnalysisInput } from '@/ai/flows/data-analyzer'; // Use new types
import { Skeleton } from '@/components/ui/skeleton';

// Updated interface to match the new structure from activity log
export interface HistoricalAnalysisStrategyItem extends ActivityLogEntry {
  details: {
    inputData: DataAnalysisInput;
    analysisOutput?: DataAnalysisStrategyOutput; // This is the playbook
    error?: string;
  };
}


export default function DataAnalysisDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const dataAnalysisHistory: HistoricalAnalysisStrategyItem[] = useMemo(() => {
    if (!isClient) return []; 
    return (activities || [])
      .filter(activity => 
        activity.module === "Data Analysis Strategy" && // Module name updated
        activity.details && 
        typeof activity.details === 'object' &&
        'inputData' in activity.details &&
        typeof (activity.details as any).inputData === 'object' &&
        ('analysisOutput' in activity.details || 'error' in activity.details) 
      )
      .map(activity => activity as HistoricalAnalysisStrategyItem) 
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Data Analysis Strategy Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {isClient ? (
          <DataAnalysisDashboardTable key={`data-analysis-dashboard-table-${(dataAnalysisHistory || []).length}`} history={dataAnalysisHistory} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of generated Data Analysis Strategies. Each entry provides a playbook based on your detailed prompts and file context. 
          Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}

    