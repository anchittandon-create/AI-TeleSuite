
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { KnowledgeBaseTable } from "@/components/features/knowledge-base/knowledge-base-table";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm onFileUpload={handleFileUpload} />
        <KnowledgeBaseTable files={files} onDeleteFile={handleDeleteFile} />
      </main>
    </div>
  );
}
