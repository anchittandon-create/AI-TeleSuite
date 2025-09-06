
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";

export default function KnowledgeBaseAddEntryPage() {
  const { addFile, addFilesBatch } = useKnowledgeBase();

  const handleAddSingleEntry = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    addFile(fileData); 
  };

  const handleAddMultipleFiles = (filesData: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>) => {
    addFilesBatch(filesData); 
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Add to Knowledge Base" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm 
          onSingleEntrySubmit={handleAddSingleEntry} 
          onMultipleFilesSubmit={handleAddMultipleFiles} 
        />
      </main>
    </div>
  );
}
