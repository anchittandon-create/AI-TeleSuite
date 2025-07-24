
"use client";

import { useState, useId, ChangeEvent } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
import { CallScoringForm, CallScoringFormValues } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { CallScoringResultsTable, ScoredCallResultItem } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
        if (scoreOutput.callCategorisation === "Error" || scoreOutput.transcriptAccuracy === "Error" || (scoreOutput.transcript && scoreOutput.transcript.startsWith("[") && scoreOutput.transcript.toLowerCase().includes("error"))) {
            if (scoreOutput.transcript && scoreOutput.transcript.startsWith("[") && scoreOutput.transcript.toLowerCase().includes("error")) {
                 resultItemError = scoreOutput.transcript; 
            } else if (scoreOutput.metricScores && scoreOutput.metricScores.length > 0 && scoreOutput.metricScores[0].feedback.toLowerCase().includes("error")) {
                 resultItemError = scoreOutput.metricScores[0].feedback;
            }
             else {
                resultItemError = scoreOutput.summary || `Call scoring failed for ${audioFile.name}. The AI model might have encountered an issue.`;
            }
        }


        const resultItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...scoreOutput,
          error: resultItemError, 
        };
        allResults.push(resultItem);
        
        activitiesToLog.push({
          module: "Call Scoring",
          product: data.product,
          details: {
            fileName: audioFile.name,
            scoreOutput: scoreOutput, 
            agentNameFromForm: data.agentName,
            error: resultItemError, 
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

      } catch (e: any) {
        console.error(`Detailed error in handleAnalyzeCall for ${audioFile.name}:`, e);
        if (e && typeof e === 'object') {
          console.error('Error message property:', e.message);
          console.error('Error stack trace:', e.stack);
          try {
            console.error('Error object (stringified):', JSON.stringify(e));
          } catch (stringifyError) {
            console.error('Could not stringify error object:', stringifyError);
          }
        }
        
        const errorMessage = e instanceof Error ? e.message :
                             (typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') ? e.message :
                             "An unexpected error occurred during the scoring process. Please check the browser console for more details.";
        
        const errorScoreOutput: ScoreCallOutput = {
            transcript: `[Critical Error scoring file: ${errorMessage.substring(0,200)}...]`,
            transcriptAccuracy: "Error",
            overallScore: 0,
            callCategorisation: "Error",
            metricScores: [{ metric: "System", score: 1, feedback: `Critical error during scoring: ${errorMessage.substring(0,200)}...` }],
            summary: `Failed to score call due to a system error: ${errorMessage.substring(0,200)}...`,
            strengths: [],
            areasForImprovement: ["Investigate system logs and browser console for the error above."],
        };
        
        const errorItem: ScoredCallResultItem = {
          id: `${uniqueIdPrefix}-${audioFile.name}-${i}`,
          fileName: audioFile.name,
          audioDataUri: audioDataUri,
          ...errorScoreOutput,
          error: errorMessage, 
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
          description: errorMessage.substring(0, 250) + (errorMessage.length > 250 ? "..." : ""),
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
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Call Scoring" />
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
              {currentFiles.length > 1 ? `Scoring call ${processedFileCount} of ${currentFiles.length}...` : 'Scoring call, this may take a moment...'}
            </p>
             <Alert variant="default" className="mt-2 max-w-md text-sm">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Please Note</AlertTitle>
                <AlertDescription>
                  Processing can take time, especially for multiple or long audio files. Please wait for completion.
                </AlertDescription>
            </Alert>
          </div>
        )}
        {error && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {results && !isLoading && results.length > 0 && (
          results.length === 1 && !results[0].error && results[0].callCategorisation !== "Error" ? (
             <CallScoringResultsCard results={results[0]} fileName={results[0].fileName} audioDataUri={results[0].audioDataUri} />
          ) : (
            <CallScoringResultsTable results={results} />
          )
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
                    1. Select the <strong>Product Focus</strong> (ET or TOI) relevant to the call(s). This is crucial for accurate scoring against product knowledge.
                </p>
                <p>
                    2. Upload one or more <strong>Audio File(s)</strong> of call recordings (e.g., MP3, WAV, M4A).
                </p>
                <p>
                    3. Optionally, enter the <strong>Agent Name</strong> if you want it associated with the scoring report.
                </p>
                <div>
                  <p>4. Click <strong>Score Call(s)</strong>. The AI will:</p>
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                      <li>Transcribe the audio, including speaker diarization (Agent, User).</li>
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
