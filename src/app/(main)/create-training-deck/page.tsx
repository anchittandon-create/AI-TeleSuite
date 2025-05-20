
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { useState } from "react";
import { BookOpen, FileText, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CreateTrainingDeckPage() {
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateDeck = async (fromFullKb: boolean = false) => {
    setIsLoading(true);
    // Placeholder for AI deck generation logic
    // For now, just show a toast and log
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate AI processing

    if (!fromFullKb && selectedFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "No Files Selected",
        description: "Please select files from the knowledge base to create a deck.",
      });
      setIsLoading(false);
      return;
    }

    const source = fromFullKb ? "the entire knowledge base" : `${selectedFiles.length} selected file(s)`;
    console.log(`Generating training deck from ${source}`);
    console.log("Selected file IDs for deck:", selectedFiles);

    toast({
      title: "Deck Generation Started (Mock)",
      description: `A training deck generation process from ${source} has been initiated. (This is a placeholder).`,
    });
    // TODO: Implement actual AI flow for deck generation and export
    // Example: const deckContent = await generateTrainingDeck({ fileIds: fromFullKb ? knowledgeBaseFiles.map(f=>f.id) : selectedFiles });
    // Example: exportToPPT(deckContent); or exportToTextFile(deckContent, "training_deck.txt");
    setIsLoading(false);
  };

  // This is a simplified multi-select using basic browser capabilities.
  // For a better UX, a component like `shadcn-multi-select` or similar would be ideal but adds complexity.
  const handleFileSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = event.target.options;
    const value: string[] = [];
    for (let i = 0, l = options.length; i < l; i++) {
      if (options[i].selected) {
        value.push(options[i].value);
      }
    }
    setSelectedFiles(value);
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Create Training Deck" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <BookOpen className="h-6 w-6 mr-3" />
              Training Deck Generator
            </CardTitle>
            <CardDescription>
              Select files from your knowledge base to generate a training deck, or create one from all content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="kb-files-select" className="mb-2 block">Select Knowledge Base Files (Ctrl/Cmd + Click for multiple)</Label>
              <select
                id="kb-files-select"
                multiple
                value={selectedFiles}
                onChange={handleFileSelectionChange}
                className="w-full p-2 border rounded-md min-h-[150px] bg-background focus:ring-primary focus:border-primary"
                disabled={knowledgeBaseFiles.length === 0}
              >
                {knowledgeBaseFiles.length === 0 && <option disabled>No files in knowledge base.</option>}
                {knowledgeBaseFiles.map(file => (
                  <option key={file.id} value={file.id}>
                    {file.isTextEntry ? `(Text) ${file.name.substring(0,50)}...` : file.name} ({file.product || 'N/A'})
                  </option>
                ))}
              </select>
              {selectedFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{selectedFiles.length} file(s) selected.</p>
              )}
            </div>

            <Button 
              onClick={() => handleGenerateDeck(false)} 
              className="w-full"
              disabled={isLoading || selectedFiles.length === 0}
            >
              <FileText className="mr-2 h-4 w-4" /> Generate Deck from Selected Files
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button 
              onClick={() => handleGenerateDeck(true)} 
              variant="outline" 
              className="w-full"
              disabled={isLoading || knowledgeBaseFiles.length === 0}
            >
              <UploadCloud className="mr-2 h-4 w-4" /> Generate Deck from Entire Knowledge Base
            </Button>
            {isLoading && <p className="text-center text-muted-foreground mt-2">Generating deck...</p>}
          </CardContent>
        </Card>
        
        <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-accent"/>
                    How it Works (Placeholder)
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>This feature is currently a placeholder for training deck generation.</p>
                <p>
                    In a future version, the AI will synthesize the content from your selected knowledge base files (or the entire KB)
                    to create structured training material.
                </p>
                <p>The output could be a text-based outline for slides or, with further development, directly exportable formats like PPT or DOCX.</p>
                 <p className="font-semibold">For now, selecting files and clicking "Generate" will simulate the start of this process.</p>
            </CardContent>
        </Card>

      </main>
    </div>
  );
}

// Placeholder Icon if not available or for specific styling
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
