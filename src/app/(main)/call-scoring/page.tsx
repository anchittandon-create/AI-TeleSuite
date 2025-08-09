
"use client";

import { useState, useId, ChangeEvent } from 'react';
import { CallScoringForm } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsTable } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { scoreCall } from '@/ai/flows/call-scoring';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { ActivityLogEntry, Product, ScoreCallOutput, HistoricalScoreItem } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CallScoringFormValues {
  inputType: "audio" | "text";
  audioFiles?: FileList;
  transcriptOverride?: string;
  agentName?: string;
  product?: string;
}

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Increase the timeout for this page and its server actions
export const maxDuration = 300; // 5 minutes

export default function CallScoringPage() {
  const [results, setResults] = useState<HistoricalScoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const uniqueIdPrefix = useId();
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setFormError(null);
    setResults([]);
    
    const product = data.product as Product | undefined;
    if (!product) {
      setFormError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const itemsToProcess: Array<{ name: string; file?: File; transcriptOverride?: string }> = [];

    if (data.inputType === 'text') {
        if (!data.transcriptOverride || data.transcriptOverride.length < 50) {
            setFormError("A transcript of at least 50 characters is required.");
            setIsLoading(false);
            return;
        }
        itemsToProcess.push({ name: "Pasted Transcript", transcriptOverride: data.transcriptOverride });
    } else if (data.inputType === 'audio') {
        if (!data.audioFiles || data.audioFiles.length === 0) {
            setFormError("Please select at least one audio file.");
            setIsLoading(false);
            return;
        }
        for (const file of Array.from(data.audioFiles)) {
             if (file.size > MAX_AUDIO_FILE_SIZE) {
                setFormError(`File "${file.name}" exceeds the 100MB limit.`);
                setIsLoading(false);
                return;
            }
            itemsToProcess.push({ name: file.name, file });
        }
    }
    
    setTotalFiles(itemsToProcess.length);
    let index = 0;

    for (const item of itemsToProcess) {
        index++;
        setCurrentFileIndex(index);
        let scoreOutput: ScoreCallOutput;
        try {
            if (item.file) { // Audio processing
                const audioDataUri = await fileToDataUrl(item.file);
                scoreOutput = await scoreCall({ product, agentName: data.agentName, audioDataUri });
            } else { // Text processing
                 scoreOutput = await scoreCall({ product, agentName: data.agentName, transcriptOverride: item.transcriptOverride });
            }
            
            if (scoreOutput.callCategorisation === "Error") {
              throw new Error(scoreOutput.summary);
            }
            
            const resultItem: HistoricalScoreItem = {
              id: `${uniqueIdPrefix}-${item.name}-${index}`,
              timestamp: new Date().toISOString(),
              module: 'Call Scoring',
              product: product,
              agentName: data.agentName,
              details: {
                fileName: item.name,
                status: 'Complete',
                agentNameFromForm: data.agentName,
                scoreOutput: scoreOutput,
              }
            };
            setResults(prev => [...prev, resultItem]);

            logActivity({
                module: 'Call Scoring', product, details: { fileName: item.name, status: 'Complete', scoreOutput, agentNameFromForm: data.agentName }
            });

        } catch (e: any) {
            const errorMessage = e.message || "An unknown error occurred.";
            console.error(`Error processing ${item.name}:`, e);
            const errorResult: HistoricalScoreItem = {
              id: `${uniqueIdPrefix}-${item.name}-${index}`,
              timestamp: new Date().toISOString(),
              module: 'Call Scoring',
              product: product,
              agentName: data.agentName,
              details: {
                fileName: item.name,
                status: 'Failed',
                agentNameFromForm: data.agentName,
                error: errorMessage,
              }
            };
            setResults(prev => [...prev, errorResult]);
            logActivity({
                module: 'Call Scoring', product, details: { fileName: item.name, status: 'Failed', error: errorMessage, agentNameFromForm: data.agentName }
            });
        }
    }

    setIsLoading(false);
    toast({ title: "All jobs finished", description: `Finished processing all ${itemsToProcess.length} item(s). Check table for results.` });
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title={`AI Call Scoring`} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <CallScoringForm 
          onSubmit={handleAnalyzeCall} 
          isLoading={isLoading} 
        />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">{totalFiles > 1 ? `Processing ${currentFileIndex} of ${totalFiles}...` : 'Processing...'}</p>
          </div>
        )}
        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>An Error Occurred</AlertTitle>
             <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline text-sm [&_svg]:ml-1">A validation error occurred. Click to view details.</AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{formError}</pre>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Alert>
        )}
        {results.length > 0 && (
          <CallScoringResultsTable results={results} />
        )}
         {results.length === 0 && !isLoading && !formError && (
          <Card className="w-full max-w-lg shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <ListChecks className="h-5 w-5 mr-2 text-accent"/>
                    How to Use AI Call Scoring
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                 <p>
                    1. Choose your input type: <strong>Upload Audio</strong> or <strong>Paste Transcript</strong>.
                </p>
                <p>
                    2. If uploading audio, you can select one or more files (up to 100MB each). The system will process them one by one.
                </p>
                 <p>
                    3. If pasting a transcript, get the text from the <strong>Audio Transcription</strong> page first.
                </p>
                <p>
                    4. Select a <strong>Product Focus</strong> for the AI to use as context for scoring.
                </p>
                <p>
                    5. Optionally, enter the <strong>Agent Name</strong>.
                </p>
                <div>
                  <p>6. Click <strong>Score Call(s)</strong>. The process will start immediately. Please wait for it to complete. For large files, this may take a few minutes.</p>
                </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
