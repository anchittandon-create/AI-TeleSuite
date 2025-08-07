
"use client";

import { useState, useId } from 'react';
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
  audioFile?: FileList;
  transcriptOverride?: string;
  agentName?: string;
  product?: string;
}

export default function CallScoringPage() {
  const [results, setResults] = useState<ScoredCallResultItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    const product = data.product as Product | undefined;

    if (data.inputType === 'text' && (!data.transcriptOverride || data.transcriptOverride.length < 50)) {
      setError("A transcript of at least 50 characters is required.");
      setIsLoading(false);
      return;
    }
    if (!product) {
      setError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const processingItems = [{ name: "Pasted Transcript" }];
    
    const allResults: ScoredCallResultItem[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];

    for (let i = 0; i < processingItems.length; i++) {
      const item = processingItems[i];
      const fileName = item.name;

      setProcessedFileCount(i + 1);
      
      try {
        setCurrentTask(`Scoring transcript...`);
        
        const scoreInput: ScoreCallInput = {
          product: product,
          agentName: data.agentName,
          transcriptOverride: data.transcriptOverride,
        };
        
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
        };
        allResults.push(resultItem);
        
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
    const failedScores = allResults.length - successfulScores;

    if (failedScores === 0 && successfulScores > 0) {
        toast({
            title: "Call Scoring Complete!",
            description: `Successfully scored ${successfulScores} transcript(s).`,
        });
    } else if (failedScores > 0) {
         toast({
            title: "Call Scoring Failed",
            description: `Could not successfully score the transcript. Check results for details.`,
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
        />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
              Processing transcript...
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
                    1. First, go to the <strong>Audio Transcription</strong> page and transcribe your audio file to get the text.
                </p>
                <p>
                    2. Copy the generated transcript.
                </p>
                <p>
                    3. Return here and paste the full, speaker-labeled transcript into the text area.
                </p>
                <p>
                    4. Select a <strong>Product Focus</strong> for the AI to use as context for scoring.
                </p>
                <p>
                    5. Optionally, enter the <strong>Agent Name</strong>.
                </p>
                <div>
                  <p>6. Click <strong>Score Call</strong>. The AI will:</p>
                  <ul className="list-disc list-inside pl-5 text-xs">
                      <li>Analyze the transcript based on the selected product and various sales metrics.</li>
                      <li>Provide an overall score, categorization, metric-wise feedback, strengths, and areas for improvement.</li>
                  </ul>
                </div>
                <p className="mt-3 font-semibold text-foreground">
                    Results will be displayed below in a detailed report card.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
