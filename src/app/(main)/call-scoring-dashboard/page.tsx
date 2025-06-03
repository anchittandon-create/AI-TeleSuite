
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { CallScoringDashboardTable } from '@/components/features/call-scoring-dashboard/dashboard-table';
import { ActivityLogEntry } from '@/types';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button'; 
import { Sheet as SheetIcon, FileText, List } from 'lucide-react'; 
import { exportToCsv, exportTableDataToPdf, exportTableDataToTxt } from '@/lib/export'; 
import { useToast } from '@/hooks/use-toast'; 
import { format, parseISO } from 'date-fns'; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface HistoricalScoreItem {
  id: string;
  timestamp: string;
  agentName?: string;
  product?: string;
  fileName: string;
  scoreOutput: ScoreCallOutput;
  // audioDataUri is intentionally omitted for historical dashboard to save space
}

export default function CallScoringDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast(); 

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

  const handleExport = (formatType: 'csv' | 'pdf' | 'txt') => {
    if (scoredCallsHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no call scoring history to export.",
      });
      return;
    }
    try {
      const headers = ["Timestamp", "Agent Name", "Product", "File Name", "Overall Score", "Categorization", "Summary Preview", "Transcript Accuracy"];
      const dataForExportObjects = scoredCallsHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.product || 'N/A',
        FileName: item.fileName,
        OverallScore: item.scoreOutput.overallScore,
        CallCategorisation: item.scoreOutput.callCategorisation,
        SummaryPreview: item.scoreOutput.summary.substring(0,100) + (item.scoreOutput.summary.length > 100 ? '...' : ''),
        TranscriptAccuracy: item.scoreOutput.transcriptAccuracy,
      }));

      const dataRowsForPdfTxt = dataForExportObjects.map(row => [
        row.Timestamp,
        row.AgentName,
        row.Product,
        row.FileName,
        String(row.OverallScore),
        String(row.CallCategorisation),
        row.SummaryPreview,
        row.TranscriptAccuracy,
      ]);

      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `call_scoring_history_${timestamp}`;

      if (formatType === 'csv') {
        exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
        toast({ title: "Export Successful", description: "Call scoring history exported to CSV." });
      } else if (formatType === 'pdf') {
        exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfTxt);
        toast({ title: "Export Successful", description: "Call scoring history exported to PDF." });
      } else if (formatType === 'txt') {
        exportTableDataToTxt(`${baseFilename}.txt`, headers, dataRowsForPdfTxt);
        toast({ title: "Export Successful", description: "Call scoring history exported to TXT/DOC." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export call scoring history to ${formatType.toUpperCase()}. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error(`Call Scoring History ${formatType.toUpperCase()} Export error:`, error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Call Scoring Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <List className="mr-2 h-4 w-4" /> Export Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <SheetIcon className="mr-2 h-4 w-4" /> Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                <FileText className="mr-2 h-4 w-4" /> Export as TXT/DOC
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          This dashboard displays a history of the most recent successfully scored calls. Original audio playback and download are **not available** for historical entries to conserve browser storage space. Full scoring reports can be viewed. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}

