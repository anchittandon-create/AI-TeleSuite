
"use client";

import { useState, useId, ChangeEvent } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/types';
import { CallScoringForm } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsTable } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { ActivityLogEntry, Product } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScoredCallResultItem } from '@/components/features/call-scoring/call-scoring-results-table';


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
  const [results, setResults] = useState<ScoredCallResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const [totalFilesToProcess, setTotalFilesToProcess] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger(); 
  const uniqueIdPrefix = useId();

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setProcessedFileCount(0);
    setTotalFilesToProcess(0);

    const product = data.product as Product | undefined;
    if (!product) {
      setError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    let processingItems: Array<{ name: string; file?: File }> = [];

    if (data.inputType === 'text') {
        if (!data.transcriptOverride || data.transcriptOverride.length < 50) {
            setError("A transcript of at least 50 characters is required.");
            setIsLoading(false);
            return;
        }
        processingItems.push({ name: "Pasted Transcript" });
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
             if (file.type && !ALLOWED_AUDIO_TYPES.includes(file.type)) {
                console.warn(`Potentially unsupported audio type for ${file.name}: ${file.type}. Transcription may fail.`);
            }
            processingItems.push({ name: file.name, file });
        }
    }
    
    setTotalFilesToProcess(processingItems.length);
    const allResults: ScoredCallResultItem[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];

    for (let i = 0; i < processingItems.length; i++) {
      const item = processingItems[i];
      const fileName = item.name;

      setProcessedFileCount(i + 1);
      
      try {
        let scoreInput: ScoreCallInput;
        if (item.file) {
            setCurrentTask(`(1/2) Transcribing ${fileName}...`);
            const audioDataUri = await fileToDataUrl(item.file);
            scoreInput = { product, agentName: data.agentName, audioDataUri };
        } else {
            scoreInput = { product, agentName: data.agentName, transcriptOverride: data.transcriptOverride };
        }

        setCurrentTask(`(2/2) Scoring ${fileName}...`);
        
        const scoreOutput = await scoreCall(scoreInput);
        
        let resultItemError: string | undefined = undefined;
        if (scoreOutput.callCategorisation === "Error") {
            resultItemError = scoreOutput.summary || `Call scoring failed for ${fileName}.`;
        }

        const resultItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${fileName}-${i}`,
          fileName: fileName,
          product: product,
          agentName: data.agentName,
          ...scoreOutput,
          error: resultItemError, 
          audioDataUri: scoreInput.audioDataUri,
        };
        allResults.push(resultItem);
        
        // Log transcription separately if audio was provided
        if (item.file) {
             activitiesToLog.push({
                module: "Transcription",
                product: "General",
                details: {
                    fileName: fileName,
                    transcriptionOutput: {
                        diarizedTranscript: scoreOutput.transcript,
                        accuracyAssessment: scoreOutput.transcriptAccuracy,
                    },
                    error: scoreOutput.transcriptAccuracy === "Error" ? scoreOutput.transcript : undefined,
                }
            });
        }
        
        const { transcript, ...scoreOutputForLogging } = scoreOutput;
        activitiesToLog.push({
          module: "Call Scoring",
          product: product,
          details: {
            fileName: fileName,
            scoreOutput: scoreOutputForLogging, 
            agentNameFromForm: data.agentName,
            error: resultItemError, 
          }
        });

      } catch (e: any) {
        console.error(`Detailed error in handleAnalyzeCall for ${fileName}:`, e);
        
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during the scoring process.";
        setError(errorMessage); 

        const errorScoreOutput: ScoreCallOutput = {
            transcript: `[Critical Client-Side Error scoring file: ${errorMessage.substring(0,200)}...]`,
            transcriptAccuracy: "System Error",
            overallScore: 0,
            callCategorisation: "Error",
            summary: errorMessage,
            strengths: ["N/A due to system error"],
            areasForImprovement: [`Investigate and resolve the critical system error: ${errorMessage.substring(0, 100)}...`],
            metricScores: [{
                metric: 'System Error',
                score: 1,
                feedback: errorMessage,
            }]
        };
        
        const errorItem = {
          id: `${uniqueIdPrefix}-${fileName}-${i}`,
          fileName: fileName,
          product: product,
          agentName: data.agentName,
          ...errorScoreOutput,
          error: errorMessage, 
        };
        allResults.push(errorItem);
        
        const { transcript, ...errorScoreOutputForLogging } = errorScoreOutput;
        activitiesToLog.push({
          module: "Call Scoring",
          product: product,
          details: { fileName: fileName, error: errorMessage, agentNameFromForm: data.agentName, scoreOutput: errorScoreOutputForLogging }
        });
        
        toast({
          variant: "destructive",
          title: `Error Processing ${fileName}`,
          description: "An error occurred. See results table or error message for details.",
          duration: 7000,
        });
      }
    }

    if (activitiesToLog.length > 0) {
      logBatchActivities(activitiesToLog);
    }

    setResults(allResults);
    setIsLoading(false);
    setCurrentTask("");
    
    const successfulScores = allResults.filter(r => !r.error).length;
    toast({
        title: "Processing Complete!",
        description: `Successfully scored ${successfulScores} of ${allResults.length} item(s).`,
    });
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
              Processing {totalFilesToProcess > 1 ? `(${processedFileCount}/${totalFilesToProcess})` : ''}...
            </p>
             <p className="text-sm text-accent-foreground/80">{currentTask}</p>
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
        {results && !isLoading && results.length > 0 && (
          <CallScoringResultsTable results={results} />
        )}
         {!results && !isLoading && !error && (
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
                  <p>6. Click <strong>Score Call(s)</strong>. The AI will:</p>
                  <ul className="list-disc list-inside pl-5 text-xs">
                      <li>First transcribe the audio (if provided), then analyze the transcript.</li>
                      <li>Provide an overall score, categorization, metric-wise feedback, strengths, and areas for improvement.</li>
                  </ul>
                </div>
                <p className="mt-3 font-semibold text-foreground">
                    Results for each file will be displayed below in a detailed report card.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
