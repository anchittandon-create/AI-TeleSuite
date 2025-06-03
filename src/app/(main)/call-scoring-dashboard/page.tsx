
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { CallScoringDashboardTable } from '@/components/features/call-scoring-dashboard/dashboard-table';
import { ActivityLogEntry } from '@/types';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button'; // Added
import { Sheet as SheetIcon } from 'lucide-react'; // Added
import { exportToCsv } from '@/lib/export'; // Added
import { useToast } from '@/hooks/use-toast'; // Added
import { format, parseISO } from 'date-fns'; // Added

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
  const { toast } = useToast(); // Added

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
        typeof (activity.details as any).fileName === 'string' && 
        typeof (activity.details as any).scoreOutput === 'object' && 
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

  const handleExportCsv = () => {
    if (scoredCallsHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no call scoring history to export.",
      });
      return;
    }
    try {
      const dataForExport = scoredCallsHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.product || 'N/A',
        FileName: item.fileName,
        OverallScore: item.scoreOutput.overallScore,
        CallCategorisation: item.scoreOutput.callCategorisation,
        Summary: item.scoreOutput.summary.substring(0,100) + (item.scoreOutput.summary.length > 100 ? '...' : ''),
        Strengths: item.scoreOutput.strengths.join('; '),
        AreasForImprovement: item.scoreOutput.areasForImprovement.join('; '),
        TranscriptAccuracy: item.scoreOutput.transcriptAccuracy,
      }));
      exportToCsv('call_scoring_history.csv', dataForExport);
      toast({
        title: "Export Successful",
        description: "Call scoring history exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export call scoring history to CSV.",
      });
      console.error("Call Scoring History CSV Export error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Call Scoring Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end">
           <Button onClick={handleExportCsv} variant="outline">
            <SheetIcon className="mr-2 h-4 w-4" /> Export All as CSV
          </Button>
        </div>
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
          This dashboard displays a history of the most recent {MAX_ACTIVITIES_TO_STORE} successfully scored calls. Original audio playback and download are **not available** for historical entries to conserve browser storage space. Full scoring reports can be viewed.
        </div>
      </main>
    </div>
  );
}
