
"use client";

import { useState, useId, ChangeEvent } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
import { CallScoringForm, CallScoringFormValues } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { CallScoringResultsTable, ScoredCallResultItem } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { Input } from '@/components/ui/input'; // For file input ref type
import type { ActivityLogEntry } from '@/types';

export default function CallScoringPage() {
  const [results, setResults] = useState<ScoredCallResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger(); 
  const uniqueIdPrefix = useId();

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setProcessedFileCount(0);

    if (!data.audioFile || data.audioFile.length === 0) {
      setError("Audio file(s) are required.");
      setIsLoading(false);
      return;
    }
    if (!data.product) {
      setError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const filesToProcess = Array.from(data.audioFile);
    setCurrentFiles(filesToProcess);
    const allResults: ScoredCallResultItem[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];


    for (let i = 0; i < filesToProcess.length; i++) {
      const audioFile = filesToProcess[i];
      setProcessedFileCount(i + 1);
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        const input: ScoreCallInput = {
          audioDataUri,
          product: data.product,
          agentName: data.agentName, 
        };

        const scoreOutput = await scoreCall(input);
        
        let resultItemError: string | undefined = undefined;
        // If the flow indicates an error in its output, capture it for the UI
        if (scoreOutput.callCategorisation === "Error" || scoreOutput.transcriptAccuracy === "Error") {
            if (scoreOutput.transcript && scoreOutput.transcript.startsWith("[") && scoreOutput.transcript.toLowerCase().includes("error")) {
                 resultItemError = scoreOutput.transcript; 
            } else {
                resultItemError = scoreOutput.summary || `Call scoring failed for ${audioFile.name}. Please check the detailed report.`;
            }
        }

        const resultItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...scoreOutput,
          error: resultItemError, // Populate error field based on output
        };
        allResults.push(resultItem);
        
        activitiesToLog.push({
          module: "Call Scoring",
          product: data.product,
          details: {
            fileName: audioFile.name,
            scoreOutput: scoreOutput, // Log the full output regardless of internal error status
            agentNameFromForm: data.agentName,
            error: resultItemError, // Also log the determined error string
          }
        });

        if (scoreOutput.transcript && scoreOutput.transcriptAccuracy) {
          activitiesToLog.push({
            module: "Transcription",
            product: data.product,
            details: {
              fileName: audioFile.name,
              transcriptionOutput: {
                diarizedTranscript: scoreOutput.transcript,
                accuracyAssessment: scoreOutput.transcriptAccuracy,
              },
              error: scoreOutput.transcriptAccuracy === "Error" ? scoreOutput.transcript : undefined,
            }
          });
        }

      } catch (e) {
        console.error(`Error scoring call ${audioFile.name}:`, e);
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        // This is a fallback ScoreCallOutput for when scoreCall itself throws an unhandled error.
        const errorScoreOutput: ScoreCallOutput = {
            transcript: `[Critical Error scoring file: ${errorMessage}]`,
            transcriptAccuracy: "Error",
            overallScore: 0,
            callCategorisation: "Error",
            metricScores: [{ metric: "System", score: 1, feedback: `Critical error during scoring: ${errorMessage}` }],
            summary: `Failed to score call due to a system error: ${errorMessage}`,
            strengths: [],
            areasForImprovement: ["Investigate system logs for the error above."],
        };
        
        const errorItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...errorScoreOutput,
          error: errorMessage, // This is a hard error from the flow call itself
        };
        allResults.push(errorItem);
        
        activitiesToLog.push({
          module: "Call Scoring",
          product: data.product,
          details: {
            fileName: audioFile.name,
            error: errorMessage,
            agentNameFromForm: data.agentName,
            scoreOutput: errorScoreOutput 
          }
        });

        activitiesToLog.push({
            module: "Transcription",
            product: data.product,
            details: {
              fileName: audioFile.name,
              transcriptionOutput: {
                diarizedTranscript: errorScoreOutput.transcript,
                accuracyAssessment: errorScoreOutput.transcriptAccuracy,
              },
              error: errorMessage,
            }
          });

        toast({
          variant: "destructive",
          title: `Error Scoring ${audioFile.name}`,
          description: errorMessage,
        });
      }
    }

    if (activitiesToLog.length > 0) {
      logBatchActivities(activitiesToLog);
    }

    setResults(allResults);
    setIsLoading(false);
    
    const successfulScores = allResults.filter(r => !r.error && r.callCategorisation !== "Error").length;
    const failedScores = allResults.length - successfulScores;

    if (failedScores === 0 && successfulScores > 0) {
        toast({
            title: "Call Scoring Complete!",
            description: `Successfully scored ${successfulScores} call(s). Transcripts (if generated) saved to dashboard.`,
        });
    } else if (successfulScores > 0 && failedScores > 0) {
        toast({
            title: "Partial Scoring Complete",
            description: `Scored ${successfulScores} call(s) successfully, ${failedScores} failed. Check results. Transcripts (if any) saved.`,
            variant: "default" 
        });
    } else if (failedScores > 0 && successfulScores === 0) {
         toast({
            title: "Call Scoring Failed",
            description: `Could not successfully score any of the ${failedScores} selected call(s). Check results for details.`,
            variant: "destructive"
        });
    }
  };
  
  const selectedFileCount = (formValues?: CallScoringFormValues) => {
    return formValues?.audioFile?.length || 0;
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Call Scoring" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <CallScoringForm 
          onSubmit={handleAnalyzeCall} 
          isLoading={isLoading} 
          submitButtonText="Score Call(s)"
          formTitle="Score Call Recording(s)"
          selectedFileCount={currentFiles.length} 
        />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
              {currentFiles.length > 1 ? `Scoring call ${processedFileCount} of ${currentFiles.length}...` : 'Scoring call, this may take a moment...'}
            </p>
             <Alert variant="default" className="mt-4 max-w-md text-sm">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Please Note</AlertTitle>
                <AlertDescription>
                  Processing can take time, especially for multiple or long audio files. Please wait for completion.
                </AlertDescription>
            </Alert>
          </div>
        )}
        {error && !isLoading && ( 
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {results && !isLoading && results.length > 0 && (
          results.length === 1 && !results[0].error ? (
             <CallScoringResultsCard results={results[0]} fileName={results[0].fileName} audioDataUri={results[0].audioDataUri} />
          ) : (
            <CallScoringResultsTable results={results} />
          )
        )}
      </main>
    </div>
  );
}
