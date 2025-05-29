
"use client";

import { useState, useId, ChangeEvent } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
import { CallScoringForm, CallScoringFormValues } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { CallScoringResultsTable, ScoredCallResultItem } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { Input } from '@/components/ui/input'; // For file input ref type

export default function CallScoringPage() {
  const [results, setResults] = useState<ScoredCallResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
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

    for (let i = 0; i < filesToProcess.length; i++) {
      const audioFile = filesToProcess[i];
      setProcessedFileCount(i + 1);
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        const input: ScoreCallInput = {
          audioDataUri,
          agentName: data.agentName, // agentName in ScoreCallInput is optional and for the AI flow if needed
          product: data.product,
        };

        const scoreOutput = await scoreCall(input);
        const resultItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...scoreOutput
        };
        allResults.push(resultItem);
        
        // Log detailed activity for the dashboard
        logActivity({
          module: "Call Scoring",
          // agentName is now handled by useActivityLogger
          product: data.product,
          details: {
            fileName: audioFile.name,
            scoreOutput: scoreOutput, // Store the full output
          }
        });

      } catch (e) {
        console.error(`Error scoring call ${audioFile.name}:`, e);
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        const errorItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri, // Store URI even if scoring failed
          transcript: `[Error scoring file: ${errorMessage}]`,
          transcriptAccuracy: "Error",
          overallScore: 0,
          callCategorisation: "Error",
          metricScores: [],
          summary: "Failed to score call.",
          strengths: [],
          areasForImprovement: [],
          error: errorMessage,
        };
        allResults.push(errorItem);
        
        // Log error activity
        logActivity({
          module: "Call Scoring",
          // agentName is now handled by useActivityLogger
          product: data.product,
          details: {
            fileName: audioFile.name,
            error: errorMessage,
            scoreOutput: { // Provide a minimal scoreOutput structure for consistency
              transcript: `[Error scoring file: ${errorMessage}]`,
              transcriptAccuracy: "Error",
              overallScore: 0,
              callCategorisation: "Error",
              metricScores: [],
              summary: `Failed to score call: ${errorMessage}`,
              strengths: [],
              areasForImprovement: []
            }
          }
        });

        toast({
          variant: "destructive",
          title: `Error Scoring ${audioFile.name}`,
          description: errorMessage,
        });
      }
    }
    setResults(allResults);
    setIsLoading(false);
    
    const successfulScores = allResults.filter(r => !r.error).length;
    const failedScores = allResults.length - successfulScores;

    if (failedScores === 0 && successfulScores > 0) {
        toast({
            title: "Call Scoring Complete!",
            description: `Successfully scored ${successfulScores} call(s).`,
        });
    } else if (successfulScores > 0 && failedScores > 0) {
        toast({
            title: "Partial Scoring Complete",
            description: `Scored ${successfulScores} call(s) successfully, ${failedScores} failed.`,
            variant: "default" 
        });
    } else if (failedScores > 0 && successfulScores === 0) {
         toast({
            title: "Call Scoring Failed",
            description: `Could not score any of the ${failedScores} selected call(s).`,
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
