
"use client";

import { useState, useId } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
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
import type { ActivityLogEntry } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CallScoringFormValues {
  inputType: "audio" | "text";
  audioFile?: FileList;
  transcriptOverride?: string;
  agentName?: string;
  product?: string;
}

export default function CallScoringPage() {
  const [results, setResults] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger(); 
  const uniqueIdPrefix = useId();

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setProcessedFileCount(0);

    if (data.inputType === 'audio' && (!data.audioFile || data.audioFile.length === 0)) {
      setError("Audio file(s) are required when input type is Audio.");
      setIsLoading(false);
      return;
    }
    if (data.inputType === 'text' && (!data.transcriptOverride || data.transcriptOverride.length < 50)) {
      setError("A transcript of at least 50 characters is required when input type is Text.");
      setIsLoading(false);
      return;
    }
    if (!data.product) {
      setError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const filesToProcess = data.inputType === 'audio' && data.audioFile ? Array.from(data.audioFile) : [];
    const processingItems = data.inputType === 'audio' ? filesToProcess : [{ name: "Pasted Transcript" }];
    
    setCurrentFiles(filesToProcess);
    const allResults: any[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];

    for (let i = 0; i < processingItems.length; i++) {
      const item = processingItems[i];
      const isAudioFile = item instanceof File;
      const fileName = isAudioFile ? item.name : item.name;

      setProcessedFileCount(i + 1);
      
      try {
        setCurrentTask(`Processing ${fileName}...`);
        
        let scoreOutput: ScoreCallOutput;
        let audioDataUri: string | undefined;

        if (isAudioFile) {
          audioDataUri = await fileToDataUrl(item);
          const scoreInput: ScoreCallInput = {
            audioDataUri,
            product: data.product as any,
            agentName: data.agentName, 
          };
          setCurrentTask(`Transcribing ${fileName}...`);
          scoreOutput = await scoreCall(scoreInput);
        } else { // Text input
          const scoreInput: ScoreCallInput = {
            product: data.product as any,
            agentName: data.agentName,
          };
          setCurrentTask(`Scoring transcript...`);
          // Pass transcript override as the second argument
          scoreOutput = await scoreCall(scoreInput, data.transcriptOverride);
        }
        
        // Log transcription sub-task if audio was processed and successful
        if (isAudioFile && scoreOutput.transcriptAccuracy !== "Error" && !scoreOutput.transcript.toLowerCase().includes("[error")) {
            activitiesToLog.push({
                module: "Transcription",
                product: data.product,
                details: {
                  fileName: fileName,
                  transcriptionOutput: {
                      diarizedTranscript: scoreOutput.transcript,
                      accuracyAssessment: scoreOutput.transcriptAccuracy,
                  },
                }
            });
        }
        
        let resultItemError: string | undefined = undefined;
        if (scoreOutput.callCategorisation === "Error") {
            resultItemError = scoreOutput.summary || scoreOutput.transcript || `Call scoring failed for ${fileName}.`;
        }

        const resultItem = {
          id: `${uniqueIdPrefix}-${fileName}-${i}`,
          fileName: fileName,
          audioDataUri: audioDataUri,
          ...scoreOutput,
          error: resultItemError, 
        };
        allResults.push(resultItem);
        
        // Log only the scoring part, excluding the full transcript for brevity in logs
        const { transcript, ...scoreOutputForLogging } = scoreOutput;
        activitiesToLog.push({
          module: "Call Scoring",
          product: data.product,
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
            transcriptAccuracy: "Error",
            overallScore: 0,
            callCategorisation: "Error",
            metricScores: [{ metric: "System", score: 1, feedback: `Critical error during scoring: ${errorMessage.substring(0,200)}...` }],
            summary: `Failed to score call due to a system error: ${errorMessage.substring(0,200)}...`,
            strengths: [],
            areasForImprovement: ["Investigate system logs and browser console for the error above."],
        };
        
        const errorItem = {
          id: `${uniqueIdPrefix}-${fileName}-${i}`,
          fileName: fileName,
          audioDataUri: isAudioFile ? await fileToDataUrl(item as File) : undefined,
          ...errorScoreOutput,
          error: errorMessage, 
        };
        allResults.push(errorItem);
        
        const { transcript, ...errorScoreOutputForLogging } = errorScoreOutput;
        activitiesToLog.push({
          module: "Call Scoring",
          product: data.product,
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
    
    const successfulScores = allResults.filter(r => !r.error && r.callCategorisation !== "Error").length;
    const failedScores = allResults.length - successfulScores;

    if (failedScores === 0 && successfulScores > 0) {
        toast({
            title: "Call Scoring Complete!",
            description: `Successfully scored ${successfulScores} item(s).`,
        });
    } else if (successfulScores > 0 && failedScores > 0) {
        toast({
            title: "Partial Scoring Complete",
            description: `Scored ${successfulScores} item(s) successfully, ${failedScores} failed. Check results for details.`,
            variant: "default" 
        });
    } else if (failedScores > 0 && successfulScores === 0) {
         toast({
            title: "Call Scoring Failed",
            description: `Could not successfully score any of the ${failedScores} selected item(s). Check results for details.`,
            variant: "destructive"
        });
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title={`AI Call Scoring`} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <CallScoringForm 
          onSubmit={handleAnalyzeCall} 
          isLoading={isLoading} 
          submitButtonText="Score Call(s)"
          formTitle="Score Call Recording(s)"
          selectedFileCount={currentFiles.length} 
        />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
              {currentFiles.length > 1 ? `Processing item ${processedFileCount} of ${currentFiles.length}...` : 'Processing call...'}
            </p>
             <p className="text-sm text-accent-foreground/80">{currentTask}</p>
             <Alert variant="default" className="mt-2 max-w-md text-sm">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Please Note</AlertTitle>
                <AlertDescription>
                  This process involves audio transcription followed by AI analysis. It can take time, especially for multiple or long files. Please wait for completion.
                </AlertDescription>
            </Alert>
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
                    1. Select a <strong>Product Focus</strong> for the AI to use as context for scoring.
                </p>
                <p>
                    2. Choose your input method: <strong>Audio File</strong> or <strong>Paste Transcript</strong>.
                </p>
                <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-xs">
                    <li>For <strong>Audio</strong>, upload one or more recordings (e.g., MP3, WAV, M4A).</li>
                    <li>For <strong>Text</strong>, paste a complete, diarized (speaker-labeled) transcript.</li>
                </ul>
                <p>
                    3. Optionally, enter the <strong>Agent Name</strong> if you want it associated with the scoring report.
                </p>
                <div>
                  <p>4. Click <strong>Score Call(s)</strong>. The AI will:</p>
                  <ul className="list-disc list-inside pl-5 text-xs">
                      <li>Transcribe the audio (if audio input is used).</li>
                      <li>Analyze the transcript based on the selected product and various sales metrics.</li>
                      <li>Provide an overall score, categorization, metric-wise feedback, strengths, and areas for improvement.</li>
                  </ul>
                </div>
                <p className="mt-3 font-semibold text-foreground">
                    Results will be displayed below. For multiple files, a summary table will appear. You can view detailed reports for each call.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

    