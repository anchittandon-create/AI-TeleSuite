
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TranscriptionDashboardTable } from '@/components/features/transcription-dashboard/dashboard-table';
import type { HistoricalTranscriptionItem, TranscriptionActivityDetails } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, List, FileSpreadsheet } from 'lucide-react';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const handleExport = (formatType: 'csv' | 'pdf' | 'doc') => {
    if (transcriptionHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no transcription history to export.",
      });
      return;
    }
    try {
      const headers = ["Timestamp", "Agent Name", "Product", "File Name", "Accuracy Assessment", "Transcript Preview", "Error"];
      const dataForExportObjects = transcriptionHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.product || 'N/A',
        FileName: item.details.fileName,
        AccuracyAssessment: item.details.transcriptionOutput.accuracyAssessment,
        TranscriptPreview: item.details.transcriptionOutput.diarizedTranscript.substring(0, 100) + (item.details.transcriptionOutput.diarizedTranscript.length > 100 ? '...' : ''),
        Error: item.details.error || '',
      }));

      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => [
        row.Timestamp,
        row.AgentName,
        row.Product,
        row.FileName,
        row.AccuracyAssessment,
        row.TranscriptPreview,
        row.Error,
      ]);

      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `transcription_history_${timestamp}`;

      if (formatType === 'csv') {
        exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
        toast({ title: "Export Successful", description: "Transcription history exported as CSV (for Excel)." });
      } else if (formatType === 'pdf') {
        exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Transcription history table exported as PDF." });
      } else if (formatType === 'doc') {
        exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Transcription history table exported as Text for Word (.doc)." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export transcription history to ${formatType.toUpperCase()}. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error(`Transcription History ${formatType.toUpperCase()} Export error:`, error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Transcription Dashboard" />
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
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV (for Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" /> Export Table as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('doc')}>
                <FileText className="mr-2 h-4 w-4" /> Export Table as Text for Word (.doc)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

