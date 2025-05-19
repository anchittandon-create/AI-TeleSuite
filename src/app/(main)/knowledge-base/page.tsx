"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { RecentUploads } from "@/components/features/knowledge-base/recent-uploads";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";

export default function KnowledgeBasePage() {
  const { files, addFile } = useKnowledgeBase();

  const handleFileUpload = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    // In a real app, this would involve uploading to a server, parsing, etc.
    // Here, we just add it to our local state via the hook.
    addFile(fileData);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm onFileUpload={handleFileUpload} />
        <RecentUploads files={files} />
      </main>
    </div>
  );
}
