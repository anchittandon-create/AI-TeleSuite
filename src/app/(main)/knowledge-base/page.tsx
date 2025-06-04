
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sheet, Trash2 } from "lucide-react"; 
import { exportToCsv } from "@/lib/export";
import { format, parseISO } from 'date-fns';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useActivityLogger } from "@/hooks/use-activity-logger";

export default function KnowledgeBasePage() {
  const { files, addFile, addFilesBatch, deleteFile, setFiles } = useKnowledgeBase();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddSingleEntry = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    addFile(fileData); 
  };

  const handleAddMultipleFiles = (filesData: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>) => {
    addFilesBatch(filesData); 
  };


  const handleDeleteFile = (fileId: string) => {
    const fileName = files.find(f => f.id === fileId)?.name || "Unknown file";
    deleteFile(fileId);
    toast({
      title: "Entry Deleted",
      description: `"${fileName}" has been removed from the knowledge base.`,
    });
  };

  const handleExportCsv = () => {
    if (files.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no data in the knowledge base to export.",
      });
      return;
    }
    try {
      const filesForExport = files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.isTextEntry ? `${file.size} chars` : file.size,
        product: file.product || 'N/A',
        persona: file.persona || 'N/A',
        isTextEntry: file.isTextEntry ? 'Yes' : 'No',
        uploadDate: format(parseISO(file.uploadDate), 'yyyy-MM-dd HH:mm:ss'),
        textContentPreview: file.isTextEntry && file.textContent ? file.textContent.substring(0, 50) + "..." : "N/A"
      }));
      exportToCsv('knowledge_base_log.csv', filesForExport);
      toast({
        title: "Export Successful",
        description: "Knowledge base log exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export knowledge base data to CSV.",
      });
      console.error("Knowledge Base CSV Export error:", error);
    }
  };

  const handleClearAllKnowledgeBase = () => {
    const count = files.length;
    setFiles([]);
    toast({
      title: "Knowledge Base Cleared",
      description: `${count} entr(y/ies) have been removed.`,
    });
    logActivity({
        module: "Knowledge Base Management",
        details: {
            action: "clear_all",
            countCleared: count,
        }
    });
    setIsClearAlertOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm 
          onSingleEntrySubmit={handleAddSingleEntry} 
          onMultipleFilesSubmit={handleAddMultipleFiles} 
        />
        
        <div className="w-full max-w-4xl flex justify-end space-x-2">
          <Button onClick={handleExportCsv} variant="outline" disabled={files.length === 0 || !isClient}>
            <Sheet className="mr-2 h-4 w-4" /> Export as CSV
          </Button>
          <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={files.length === 0 || !isClient}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear All Entries
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all 
                  ({files.length}) entries from your knowledge base.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAllKnowledgeBase} className="bg-destructive hover:bg-destructive/90">
                  Yes, delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        {isClient ? (
          <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
        ) : (
          <div className="w-full max-w-4xl space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </main>
    </div>
  );
}
