
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

// Increase the timeout for this page and its server actions
export const maxDuration = 300; // 5 minutes

interface CallScoringFormValues {
  inputType: "audio" | "text";
  audioFiles?: FileList;
  transcriptOverride?: string;
  agentName?: string;
  product?: string;
}

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
];


export default function CallScoringPage() {
  const [results, setResults] = useState<HistoricalScoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const [totalFilesToProcess, setTotalFilesToProcess] = useState(0);
  const uniqueIdPrefix = useId();

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    const product = data.product as Product | undefined;
    if (!product) {
      setError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    let processingItems: Array<{ name: string; file?: File; transcriptOverride?: string }> = [];

    if (data.inputType === 'text') {
        if (!data.transcriptOverride || data.transcriptOverride.length < 50) {
            setError("A transcript of at least 50 characters is required.");
            setIsLoading(false);
            return;
        }
        processingItems.push({ name: "Pasted Transcript", transcriptOverride: data.transcriptOverride });
    } else if (data.inputType === 'audio') {
        if (!data.audioFiles || data.audioFiles.length === 0) {
            setError("Please select at least one audio file.");
            setIsLoading(false);
            return;
        }
        for (const file of Array.from(data.audioFiles)) {
             if (file.size > MAX_AUDIO_FILE_SIZE) {
                setError(`File "${file.name}" exceeds the 100MB limit.`);
                setIsLoading(false);
                return;
            }
            processingItems.push({ name: file.name, file });
        }
    }
    
    setTotalFilesToProcess(processingItems.length);
    const allResults: HistoricalScoreItem[] = [];

    for (let i = 0; i < processingItems.length; i++) {
      const item = processingItems[i];
      setProcessedFileCount(i + 1);

      try {
        let scoreOutput: ScoreCallOutput;
        if (item.file) {
          const audioDataUri = await fileToDataUrl(item.file);
          scoreOutput = await scoreCall({ audioDataUri, product: product!, agentName: data.agentName });
        } else {
          scoreOutput = await scoreCall({ transcriptOverride: item.transcriptOverride, product: product!, agentName: data.agentName });
        }

        const resultItem: HistoricalScoreItem = {
          id: `${uniqueIdPrefix}-${item.name}-${i}`,
          timestamp: new Date().toISOString(),
          module: 'Call Scoring',
          product: product,
          agentName: data.agentName,
          details: {
            fileName: item.name,
            scoreOutput,
            agentNameFromForm: data.agentName,
            error: scoreOutput.callCategorisation === "Error" ? scoreOutput.summary : undefined,
          },
        };

        allResults.push(resultItem);

        logActivity({
          module: 'Call Scoring',
          product: product,
          agentName: data.agentName,
          details: {
            fileName: item.name,
            scoreOutput: resultItem.details.scoreOutput,
            agentNameFromForm: data.agentName,
            error: resultItem.details.error,
          },
        });
        
        toast({ title: `Successfully Scored: ${item.name}`, description: `Overall Score: ${scoreOutput.overallScore.toFixed(1)}/5`});

      } catch (e: any) {
        const errorMessage = e.message || "An unknown server error occurred.";
        console.error(`Error processing ${item.name}:`, e);
        setError(`Failed to process ${item.name}: ${errorMessage}`);
        toast({ variant: 'destructive', title: `Error processing ${item.name}`, description: errorMessage });

        logActivity({
          module: 'Call Scoring',
          product: product,
          agentName: data.agentName,
          details: {
            fileName: item.name,
            agentNameFromForm: data.agentName,
            error: errorMessage,
          },
        });
      }
    }

    setResults(allResults);
    setIsLoading(false);
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
            <p className="text-muted-foreground">
              {totalFilesToProcess > 1 
                ? `Processing file ${processedFileCount} of ${totalFilesToProcess}...` 
                : "Processing..."}
            </p>
          </div>
        )}
        {error && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <Accordion type="single" collapsible className="w-full text-sm">
              <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline [&[data-state=open]>svg]:text-destructive-foreground [&_svg]:ml-1">A system error occurred during processing. Click to view details.</AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{error}</pre>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Alert>
        )}
        {results.length > 0 && !isLoading && (
          <CallScoringResultsTable results={results} />
        )}
         {results.length === 0 && !isLoading && !error && (
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
                    2. If uploading audio, you can select one or more files (up to 100MB each).
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
                  <p>6. Click <strong>Score Call(s)</strong>. The system will process each file and display the results below.</p>
                </div>
                <p className="mt-3 font-semibold text-foreground">
                    Results for each file will be displayed in the table below.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
