
"use client";

import { KnowledgeBaseForm } from "@/components/features/knowledge-base/knowledge-base-form";
import { PageHeader } from "@/components/layout/page-header";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { KnowledgeFile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";


export default function AddKnowledgeBaseEntryPage() {
  const { addFile, addFilesBatch } = useKnowledgeBase();
  const { toast } = useToast();

  const handleAddSingleEntry = (fileData: Omit<KnowledgeFile, 'id' | 'uploadDate'>) => {
    addFile(fileData); 
  };

  const handleAddMultipleFiles = (filesData: Array<Omit<KnowledgeFile, 'id' | 'uploadDate'>>) => {
    addFilesBatch(filesData); 
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Add Knowledge Base Entry" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-8">
        <KnowledgeBaseForm 
          onSingleEntrySubmit={handleAddSingleEntry} 
          onMultipleFilesSubmit={handleAddMultipleFiles} 
        />

        <Card className="w-full max-w-lg shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-accent"/>
                    About the Knowledge Base
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    The Knowledge Base is the central repository of information that the AI agents use to generate contextual responses. All files and text entries added here can be used by features like the Pitch Generator, Rebuttal Assistant, and Voice Agents.
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                    <li><strong>File Content:</strong> The text content of readable files (like .txt, .md, .csv) is extracted and used by the AI. For other formats (PDF, DOCX), the AI uses the file's name and metadata as context.</li>
                    <li><strong>Product Association:</strong> Each entry must be associated with a product, ensuring that AI responses are relevant to the selected product context.</li>
                    <li><strong>Category:</strong> Assigning a category (e.g., "Pricing", "Pitch") helps the AI prioritize and structure its responses more effectively.</li>
                </ul>
                <p className="font-semibold mt-2">
                    A well-maintained Knowledge Base is crucial for generating high-quality, accurate AI responses.
                </p>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
