
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sheet } from "lucide-react"; // Using Sheet icon as a generic export icon
import { exportToCsv } from "@/lib/export";
import { format, parseISO } from 'date-fns';

export default function KnowledgeBasePage() {
  const { files, addFile, deleteFile } = useKnowledgeBase();
  const { toast } = useToast();

  const handleFileUpload = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    addFile(fileData);
  };

  const handleDeleteFile = (fileId: string) => {
    deleteFile(fileId);
    toast({
      title: "File Deleted",
      description: "The file has been removed from the knowledge base.",
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
      // Sanitize details for CSV
      const filesForExport = files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        product: file.product || 'N/A',
        persona: file.persona || 'N/A',
        uploadDate: format(parseISO(file.uploadDate), 'yyyy-MM-dd HH:mm:ss')
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


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm onFileUpload={handleFileUpload} />
        
        <div className="w-full max-w-4xl flex justify-end">
          <Button onClick={handleExportCsv} variant="outline">
            <Sheet className="mr-2 h-4 w-4" /> Export as CSV
          </Button>
        </div>
        
        <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
      </main>
    </div>
  );
}
