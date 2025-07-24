"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TranscriptionDashboardTable } from '@/components/features/transcription-dashboard/dashboard-table';
import { ActivityLogEntry, HistoricalTranscriptionItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button'; 
import { Download, FileArchive } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast'; 

export default function TranscriptionDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
        'transcriptionOutput' in activity.details && 
        'fileName' in activity.details &&
        typeof (activity.details as any).fileName === 'string' &&
        typeof (activity.details as any).transcriptionOutput === 'object'
      )
      .map(activity => ({
        id: activity.id,
        timestamp: activity.timestamp,
        agentName: activity.agentName,
        product: activity.product,
        details: activity.details as any, // Cast to any to satisfy typing
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleExport = useCallback(async (idsToExport: string[], all: boolean) => {
    const itemsToExport = all ? transcriptionHistory : transcriptionHistory.filter(item => idsToExport.includes(item.id));
    
    if (itemsToExport.length === 0) {
      toast({
        variant: "default",
        title: "No Transcripts Selected",
        description: "Please select one or more transcripts to export.",
      });
      return;
    }
    
    toast({
        title: "Preparing ZIP...",
        description: `Bundling ${itemsToExport.length} transcript(s). This may take a moment.`,
    });

    try {
      const zip = new JSZip();
      for (const item of itemsToExport) {
        if (item.details.transcriptionOutput?.diarizedTranscript && !item.details.error) {
          const fileName = (item.details.fileName ? (item.details.fileName.includes('.') ? item.details.fileName.substring(0, item.details.fileName.lastIndexOf('.')) : item.details.fileName) : "transcript") + ".txt";
          zip.file(fileName, item.details.transcriptionOutput.diarizedTranscript);
        }
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      link.download = `transcripts_export_${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({
        title: "Export Successful",
        description: `${itemsToExport.length} transcript(s) have been downloaded as a ZIP file.`,
      });

    } catch (error) {
      console.error("ZIP Export error:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export transcripts. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

  }, [transcriptionHistory, toast]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Transcription Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end gap-2">
            <Button
                onClick={() => handleExport(selectedIds, false)}
                disabled={selectedIds.length === 0}
            >
                <Download className="mr-2 h-4 w-4" /> Export Selected as ZIP ({selectedIds.length})
            </Button>
           <Button
                onClick={() => handleExport([], true)}
                variant="outline"
                disabled={transcriptionHistory.length === 0}
            >
                <FileArchive className="mr-2 h-4 w-4" /> Export All as ZIP ({transcriptionHistory.length})
            </Button>
        </div>
        {isClient ? (
          <TranscriptionDashboardTable 
            history={transcriptionHistory}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of successful transcriptions. Original audio playback and download are **not available** for historical entries to conserve browser storage space. Full transcripts can be viewed. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}