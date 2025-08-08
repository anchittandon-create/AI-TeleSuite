
"use client";

import { useState, useId, ChangeEvent, useEffect } from 'react';
import { CallScoringForm } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsTable } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { processCall } from '@/ai/flows/combined-call-processing'; 
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

export default function CallScoringPage() {
  const [results, setResults] = useState<HistoricalScoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity, activities } = useActivityLogger();
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const uniqueIdPrefix = useId();

  // Polling for updates
  useEffect(() => {
    const pendingOrProcessingJobs = results.some(r => r.details.status === 'Queued' || r.details.status === 'Pending' || r.details.status === 'Transcribing' || r.details.status === 'Scoring');

    if (!pendingOrProcessingJobs) {
      return;
    }
    
    const interval = setInterval(() => {
      // Find the corresponding activities from the global state
      const updatedResults = results.map(job => {
        const correspondingActivity = activities.find(a => a.id === job.id);
        if (correspondingActivity) {
          return correspondingActivity as HistoricalScoreItem;
        }
        return job;
      });
      setResults(updatedResults);
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [results, activities]);


  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setFormError(null);
    setResults([]);
    setProcessingMessage('Preparing jobs...');

    const product = data.product as Product | undefined;
    if (!product) {
      setFormError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    let processingItems: Array<{ name: string; file?: File; transcriptOverride?: string }> = [];

    if (data.inputType === 'text') {
        if (!data.transcriptOverride || data.transcriptOverride.length < 50) {
            setFormError("A transcript of at least 50 characters is required.");
            setIsLoading(false);
            return;
        }
        processingItems.push({ name: "Pasted Transcript", transcriptOverride: data.transcriptOverride });
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
            processingItems.push({ name: file.name, file });
        }
    }
    
    // Step 1: Immediately show jobs as "Queued" in the UI
    const initialJobs: HistoricalScoreItem[] = processingItems.map((item, i) => ({
      id: `${uniqueIdPrefix}-${item.name}-${i}`,
      timestamp: new Date().toISOString(),
      module: 'Call Scoring',
      product: product,
      agentName: data.agentName,
      details: {
        fileName: item.name,
        status: 'Queued',
        agentNameFromForm: data.agentName,
      },
    }));
    setResults(initialJobs);
    setIsLoading(false); // UI is now responsive, backend processing starts
    setProcessingMessage(`${processingItems.length} job(s) queued. Processing will start shortly.`);


    // Step 2: Asynchronously process each job
    for (let i = 0; i < processingItems.length; i++) {
      const item = processingItems[i];
      const job = initialJobs[i];

      try {
        // Log the activity to get a stable ID and set it to Pending
        const activityId = logActivity({
          module: 'Call Scoring',
          product: product,
          agentName: data.agentName,
          details: {
            fileName: item.name,
            agentNameFromForm: data.agentName,
            status: 'Pending',
          },
        });

        // Update the local job with the real activity ID
        job.id = activityId;
        setResults(prev => prev.map(p => p.details.fileName === item.name ? job : p));

        let audioDataUri: string | undefined = undefined;
        if (item.file) {
           audioDataUri = await fileToDataUrl(item.file);
        }

        // Fire and forget the orchestrator flow
        processCall({
          activityId: activityId,
          product: product!,
          agentName: data.agentName,
          audioDataUri: audioDataUri,
          transcriptOverride: item.transcriptOverride
        }).catch(orchestratorError => {
            // This catch is for errors in *triggering* the flow, not the flow's execution.
            console.error(`Error triggering processing for ${item.name}:`, orchestratorError);
             // Update the specific job in the UI to failed
            setResults(prev => prev.map(p => p.id === activityId ? { ...p, details: {...p.details, status: 'Failed', error: `Failed to start job: ${orchestratorError.message}` }} : p));
        });

      } catch (e: any) {
        const errorMessage = e.message || "An unknown client-side error occurred.";
        console.error(`Client-side error preparing ${item.name}:`, e);
        // Update the specific job in the UI to failed
        setResults(prev => prev.map(p => p.id === job.id ? { ...p, details: {...p.details, status: 'Failed', error: errorMessage }} : p));
      }
    }
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
            <p className="text-muted-foreground">{processingMessage}</p>
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
        {results.length > 0 && !isLoading && (
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
                  <p>6. Click <strong>Score Call(s)</strong>. Jobs will be queued and processed in the background. The table below will show their live status.</p>
                </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

    