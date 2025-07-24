
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TranscriptionDashboardTable } from '@/components/features/transcription-dashboard/dashboard-table';
import type { HistoricalTranscriptionItem, TranscriptionActivityDetails } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download, FileArchive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';


export default function TranscriptionDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const handleExport = async (itemsToExport: HistoricalTranscriptionItem[]) => {
    if (itemsToExport.length === 0) {
      toast({
        variant: "default",
        title: "No Transcripts to Export",
        description: "There are no transcripts to export.",
      });
      return;
    }

    toast({
        title: "Preparing ZIP File...",
        description: `Bundling ${itemsToExport.length} transcript(s). Please wait.`,
    });

    const zip = new JSZip();
    
    itemsToExport.forEach(item => {
        const transcriptText = item.details.transcriptionOutput?.diarizedTranscript || `Error or empty transcript for ${item.details.fileName}`;
        const fileName = (item.details.fileName ? item.details.fileName.substring(0, item.details.fileName.lastIndexOf('.')) : item.id) + "_transcript.txt";
        zip.file(fileName, transcriptText);
    });

    try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
        link.download = `transcripts_batch_${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        toast({
            title: "Export Successful!",
            description: `${itemsToExport.length} transcript(s) have been exported in a ZIP file.`,
        });
    } catch (error) {
        console.error("ZIP Export Error:", error);
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: "An error occurred while creating the ZIP file.",
        });
    }
  };

  const handleExportAll = () => {
    handleExport(transcriptionHistory);
  };

  const handleExportSelected = () => {
    const selectedItems = transcriptionHistory.filter(item => selectedIds.includes(item.id));
    handleExport(selectedItems);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Transcription Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end space-x-2">
            {selectedIds.length > 0 && (
                <Button onClick={handleExportSelected} variant="outline">
                    <Download className="mr-2 h-4 w-4" /> Export Selected ({selectedIds.length}) as ZIP
                </Button>
            )}
           <Button onClick={handleExportAll} disabled={transcriptionHistory.length === 0}>
             <FileArchive className="mr-2 h-4 w-4" /> Export All as ZIP
           </Button>
        </div>
        {isClient ? (
          <TranscriptionDashboardTable 
            history={transcriptionHistory}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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
          This dashboard displays a history of generated transcripts. Audio playback or download of the original audio files is **not available** for historical entries to conserve browser storage space. Full transcript text can be viewed and downloaded. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}
