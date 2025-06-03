
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TranscriptionDashboardTable } from '@/components/features/transcription-dashboard/dashboard-table';
import type { HistoricalTranscriptionItem, TranscriptionActivityDetails } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet as SheetIcon } from 'lucide-react';
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

export default function TranscriptionDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const transcriptionHistory: HistoricalTranscriptionItem[] = useMemo(() => {
    if (!isClient) return [];
    return (activities || [])
      .filter(activity =>
        activity.module === "Transcription" &&
        activity.details &&
        typeof activity.details === 'object' &&
        'fileName' in activity.details &&
        'transcriptionOutput' in activity.details &&
        typeof (activity.details as TranscriptionActivityDetails).fileName === 'string' &&
        typeof (activity.details as TranscriptionActivityDetails).transcriptionOutput === 'object'
      )
      .map(activity => activity as HistoricalTranscriptionItem)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleExportCsv = () => {
    if (transcriptionHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no transcription history to export.",
      });
      return;
    }
    try {
      const dataForExport = transcriptionHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.product || 'N/A',
        FileName: item.details.fileName,
        AccuracyAssessment: item.details.transcriptionOutput.accuracyAssessment,
        TranscriptPreview: item.details.transcriptionOutput.diarizedTranscript.substring(0, 100) + (item.details.transcriptionOutput.diarizedTranscript.length > 100 ? '...' : ''),
        Error: item.details.error || '',
      }));
      exportToCsv('transcription_history.csv', dataForExport);
      toast({
        title: "Export Successful",
        description: "Transcription history exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export transcription history to CSV.",
      });
      console.error("Transcription History CSV Export error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Transcription Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleExportCsv} variant="outline">
            <SheetIcon className="mr-2 h-4 w-4" /> Export All as CSV
          </Button>
        </div>
        {isClient ? (
          <TranscriptionDashboardTable key={`transcription-dashboard-table-${(transcriptionHistory || []).length}`} history={transcriptionHistory} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of generated transcripts. Audio playback or download of the original audio files is **not available** for historical entries to conserve browser storage space. Full transcript text can be viewed and downloaded. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}
