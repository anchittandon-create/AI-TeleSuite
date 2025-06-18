
"use client";

import { useState, useId } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
import { analyzeCallBatch } from '@/ai/flows/combined-call-scoring-analysis';
import type { CombinedCallAnalysisInput, CombinedCallAnalysisReportOutput, IndividualCallScoreDataItem } from '@/types';

import { CombinedCallAnalysisForm, CombinedCallAnalysisFormValues } from '@/components/features/combined-call-analysis/combined-call-analysis-form';
import { CombinedCallAnalysisResultsCard } from '@/components/features/combined-call-analysis/combined-call-analysis-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks, PieChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from '@/components/ui/card';
import type { ActivityLogEntry, CombinedCallAnalysisActivityDetails } from '@/types';

export default function CombinedCallAnalysisPage() {
  const [combinedReport, setCombinedReport] = useState<CombinedCallAnalysisReportOutput | null>(null);
  const [individualScores, setIndividualScores] = useState<IndividualCallScoreDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProcessMessage, setCurrentProcessMessage] = useState<string>("");
  const [processedFileCount, setProcessedFileCount] = useState(0);
  const [totalFilesToProcess, setTotalFilesToProcess] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { logActivity, logBatchActivities } = useActivityLogger();
  const uniqueIdPrefix = useId();

  const handleAnalyzeBatch = async (data: CombinedCallAnalysisFormValues) => {
    setIsLoading(true);
    setFormError(null);
    setCombinedReport(null);
    setIndividualScores([]);
    setProcessedFileCount(0);
    
    if (!data.audioFiles || data.audioFiles.length === 0) {
      setFormError("Audio file(s) are required.");
      setIsLoading(false);
      return;
    }
    if (!data.product) {
      setFormError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const filesToProcess = Array.from(data.audioFiles);
    setTotalFilesToProcess(filesToProcess.length);
    const allIndividualResults: IndividualCallScoreDataItem[] = [];
    const individualScoreActivities: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];
    const individualCallScoreDetailsForCombinedLog: CombinedCallAnalysisActivityDetails['individualCallScoreDetails'] = [];

    setCurrentProcessMessage(`Starting individual call scoring...`);

    for (let i = 0; i < filesToProcess.length; i++) {
      const audioFile = filesToProcess[i];
      setProcessedFileCount(i + 1);
      setCurrentProcessMessage(`Processing file ${i + 1} of ${filesToProcess.length}: ${audioFile.name}... (Transcription & Individual Scoring)`);
      let audioDataUri = "";
      try {
        audioDataUri = await fileToDataUrl(audioFile);
        const individualInput: ScoreCallInput = {
          audioDataUri,
          product: data.product,
          agentName: data.agentName, // Use agent name from form for individual scores if provided
        };

        const scoreOutput = await scoreCall(individualInput);
        const resultItem: IndividualCallScoreDataItem = {
          fileName: audioFile.name,
          scoreOutput: scoreOutput,
        };
        allIndividualResults.push(resultItem);
        individualCallScoreDetailsForCombinedLog.push({
            fileName: audioFile.name,
            score: scoreOutput.overallScore,
            error: scoreOutput.callCategorisation === "Error" ? scoreOutput.summary : undefined
        });
        
        // Log individual call scoring activity
        individualScoreActivities.push({
          module: "Call Scoring (Individual for Batch)",
          product: data.product,
          details: {
            fileName: audioFile.name,
            scoreOutput: scoreOutput, 
            agentNameFromForm: data.agentName,
            context: "Part of combined analysis batch",
          }
        });
        // Log transcription if successful
        if (scoreOutput.transcript && scoreOutput.transcriptAccuracy && scoreOutput.transcriptAccuracy !== "Error") {
          individualScoreActivities.push({
            module: "Transcription (Individual for Batch)",
            product: data.product,
            details: {
              fileName: audioFile.name,
              transcriptionOutput: {
                diarizedTranscript: scoreOutput.transcript,
                accuracyAssessment: scoreOutput.transcriptAccuracy,
              },
              context: "Part of combined analysis batch",
            }
          });
        }

      } catch (e: any) {
        const errorMessage = e.message || "Unknown error during individual scoring.";
        toast({ variant: "destructive", title: `Error scoring ${audioFile.name}`, description: errorMessage.substring(0,100) });
        // Store a basic error structure for this file
        const errorScoreOutput: ScoreCallOutput = {
            transcript: `[Error processing ${audioFile.name}: ${errorMessage}]`, transcriptAccuracy: "Error",
            overallScore: 0, callCategorisation: "Error", metricScores: [], summary: errorMessage, strengths: [], areasForImprovement: []
        };
        allIndividualResults.push({ fileName: audioFile.name, scoreOutput: errorScoreOutput });
        individualCallScoreDetailsForCombinedLog.push({fileName: audioFile.name, score: 0, error: errorMessage});

         individualScoreActivities.push({
          module: "Call Scoring (Individual for Batch)", product: data.product,
          details: { fileName: audioFile.name, error: errorMessage, scoreOutput: errorScoreOutput, agentNameFromForm: data.agentName, context: "Part of combined analysis batch" }
        });
      }
    }
    
    if (individualScoreActivities.length > 0) {
        logBatchActivities(individualScoreActivities);
    }
    setIndividualScores(allIndividualResults); // Store individual scores for potential later display

    if (allIndividualResults.length === 0 || allIndividualResults.every(r => r.scoreOutput.callCategorisation === "Error")) {
        setFormError("All individual call scorings failed. Cannot proceed to combined analysis.");
        setCurrentProcessMessage("Combined analysis aborted due to errors in individual scoring.");
        setIsLoading(false);
        toast({ variant: "destructive", title: "Combined Analysis Failed", description: "All individual calls failed to score. Please check individual errors." });
        
        logActivity({
            module: "Combined Call Analysis", product: data.product,
            details: {
                input: { callReports: [], product: data.product, overallAnalysisGoal: data.overallAnalysisGoal },
                error: "All individual call scorings failed.",
                individualCallScoreDetails: individualCallScoreDetailsForCombinedLog
            } as CombinedCallAnalysisActivityDetails
        });
        return;
    }
    
    setCurrentProcessMessage("Generating combined analysis report...");

    const combinedInput: CombinedCallAnalysisInput = {
      callReports: allIndividualResults,
      product: data.product,
      overallAnalysisGoal: data.overallAnalysisGoal
    };

    try {
      const finalReport = await analyzeCallBatch(combinedInput);
      setCombinedReport(finalReport);
      setCurrentProcessMessage("Combined analysis complete!");
      if (finalReport.reportTitle.startsWith("Error:") || finalReport.reportTitle.startsWith("Critical Error:")) {
        toast({ variant: "destructive", title: "Combined Analysis Error", description: finalReport.batchExecutiveSummary, duration: 7000 });
      } else {
        toast({ title: "Combined Analysis Complete!", description: "Aggregated report is ready." });
      }

      logActivity({
        module: "Combined Call Analysis",
        product: data.product,
        details: {
            input: combinedInput,
            output: finalReport,
            individualCallScoreDetails: individualCallScoreDetailsForCombinedLog
        } as CombinedCallAnalysisActivityDetails
      });

    } catch (e: any) {
      const errorMessage = e.message || "Unknown error during combined analysis.";
      setFormError(`Combined analysis failed: ${errorMessage}`);
      setCurrentProcessMessage(`Error generating combined report: ${errorMessage.substring(0,100)}`);
      toast({ variant: "destructive", title: "Combined Analysis Failed", description: errorMessage });
       logActivity({
        module: "Combined Call Analysis",
        product: data.product,
        details: {
            input: combinedInput,
            error: errorMessage,
            individualCallScoreDetails: individualCallScoreDetailsForCombinedLog
        } as CombinedCallAnalysisActivityDetails
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Combined Call Scoring Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <CombinedCallAnalysisForm 
          onSubmit={handleAnalyzeBatch} 
          isLoading={isLoading}
          processedFileCount={processedFileCount}
          totalFilesToProcess={totalFilesToProcess}
        />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground text-center">{currentProcessMessage || "Processing..."}</p>
          </div>
        )}
        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {combinedReport && !isLoading && (
          <CombinedCallAnalysisResultsCard report={combinedReport} individualScores={individualScores} />
        )}
         {!combinedReport && !isLoading && !formError && (
          <Card className="w-full max-w-lg shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-accent"/>
                    About Combined Call Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    This feature allows you to analyze a batch of call recordings to get a high-level understanding of overall performance, common themes, and trends.
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                    <li>Select the <strong>Product Focus</strong> for the calls.</li>
                    <li>Upload multiple <strong>Audio Files</strong> (e.g., MP3, WAV). A minimum of 2 and a maximum of 10 files are recommended for effective analysis.</li>
                    <li>Optionally, provide a <strong>Specific Analysis Goal</strong> to guide the AI's focus for the combined report (e.g., "focus on objection handling for price concerns").</li>
                    <li>Optionally, enter an <strong>Agent Name or Analyst Name</strong> for reference.</li>
                    <li>Click <strong>Analyze Batch</strong>. The process involves:
                        <ul className="list-disc list-inside pl-5 text-xs">
                            <li>Each call is individually transcribed and scored.</li>
                            <li>An AI then synthesizes these individual reports into a single combined analysis.</li>
                        </ul>
                    </li>
                </ol>
                <p className="mt-3 font-semibold text-foreground">
                    The combined report will provide an executive summary, average scores, common strengths and weaknesses, key themes, and metric performance summaries for the entire batch.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
```