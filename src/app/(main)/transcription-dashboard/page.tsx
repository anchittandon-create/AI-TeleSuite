
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TranscriptionDashboardTable } from '@/components/features/transcription-dashboard/dashboard-table';
import { ActivityLogEntry, HistoricalTranscriptionItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button'; 
import { Download, FileArchive, Trash2 } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast'; 
import { generateTextPdfBlob } from '@/lib/pdf-utils';
import { formatTranscriptSegments } from '@/lib/transcript-utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


const isTranscriptionHistoryEntry = (activity: ActivityLogEntry): activity is HistoricalTranscriptionItem => {
  const { details } = activity;
  return (
    typeof details === 'object' &&
    details !== null &&
    'transcriptionOutput' in details &&
    'fileName' in details &&
    typeof (details as { fileName?: unknown }).fileName === 'string' &&
    typeof (details as { transcriptionOutput?: unknown }).transcriptionOutput === 'object'
  );
};

export default function TranscriptionDashboardPage() {
  const { activities, deleteActivities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast(); 
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const transcriptionHistory: HistoricalTranscriptionItem[] = useMemo(() => {
    if (!isClient) return []; 
    return (activities || [])
      .filter(activity => activity.module === "Transcription" && isTranscriptionHistoryEntry(activity))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleDeleteSelected = () => {
    deleteActivities(selectedIds);
    toast({ title: "Transcripts Deleted", description: `${selectedIds.length} transcripts have been deleted.` });
    setSelectedIds([]);
  };

  const handleClearAllConfirm = () => {
    const idsToDelete = transcriptionHistory.map(item => item.id);
    deleteActivities(idsToDelete);
    toast({ title: "All Transcripts Deleted", description: "All transcripts have been cleared from the log." });
    setIsClearAlertOpen(false);
  };


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
        description: `Bundling ${itemsToExport.length} transcript(s) as PDFs. This may take a moment.`,
    });

    try {
      const zip = new JSZip();
      for (const item of itemsToExport) {
        // Format segments using standard utility instead of old diarizedTranscript field
        if (item.details.transcriptionOutput?.segments && !item.details.error) {
          const formattedTranscript = formatTranscriptSegments(item.details.transcriptionOutput);
          const pdfBlob = generateTextPdfBlob(formattedTranscript);
          const baseName = item.details.fileName.includes('.') ? item.details.fileName.substring(0, item.details.fileName.lastIndexOf('.')) : item.details.fileName;
          zip.file(`${baseName}_Transcript.pdf`, pdfBlob);
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
        description: `${itemsToExport.length} transcript(s) have been downloaded as a ZIP file of PDFs.`,
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
    <>
    <div className="flex flex-col h-full">
      <PageHeader title="Transcription Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end gap-2">
            <Button
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0}
                variant="destructive"
            >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.length})
            </Button>
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
             <Button
                onClick={() => setIsClearAlertOpen(true)}
                disabled={transcriptionHistory.length === 0}
                variant="destructive"
                className="bg-destructive/80 hover:bg-destructive/90"
             >
                 <Trash2 className="mr-2 h-4 w-4" /> Clear All
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
          This dashboard displays a history of successful transcriptions. Each entry now includes audio playback and download controls alongside the transcript. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
     <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all ({transcriptionHistory.length}) transcripts from your activity log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, Clear All Transcripts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
