
"use client";

import { useState, useId } from 'react';
import { analyzeData } from '@/ai/flows/data-analyzer'; 
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer'; // Updated type
import { DataAnalysisForm, DataAnalysisFormValues } from '@/components/features/data-analysis/data-analysis-form';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisResultsCard } from '@/components/features/data-analysis/data-analysis-results-card';
import type { ActivityLogEntry } from '@/types';

export interface AnalysisReportResultItem { // Renamed for clarity
  id: string;
  userAnalysisPrompt: string;
  fileDetails: DataAnalysisInput['fileDetails'];
  analysisOutput: DataAnalysisReportOutput; // Updated type
  error?: string;
}

export default function DataAnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisReportResultItem | null>(null); // Updated type
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); 
  const [selectedFileCountInForm, setSelectedFileCountInForm] = useState(0);


  const { toast } = useToast();
  const { logActivity } = useActivityLogger(); 
  const uniqueIdPrefix = useId();

  const handleGenerateAnalysis = async (flowInput: DataAnalysisInput) => { // Renamed handler
    setIsLoading(true);
    setFormError(null);
    setAnalysisResult(null); 
    
    setSelectedFileCountInForm(flowInput.fileDetails.length);

    try {
      const result = await analyzeData(flowInput); 
      
      const resultItem: AnalysisReportResultItem = { // Updated type
          id: `${uniqueIdPrefix}-analysis`,
          userAnalysisPrompt: flowInput.userAnalysisPrompt,
          fileDetails: flowInput.fileDetails,
          analysisOutput: result,
      };
      setAnalysisResult(resultItem);

      logActivity({ 
        module: "Data Analysis", // Updated module name for logs
        details: {
          inputData: flowInput,
          analysisOutput: result, // Log the new report output
        }
      });
      
      toast({
          title: "Data Analysis Complete!",
          description: "Your analysis report is ready.",
      });

    } catch (e) {
      console.error(`Error generating analysis report:`, e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during analysis generation.";
      
      const errorOutput: DataAnalysisReportOutput = { // Match new error structure
          reportTitle: `Error Generating Analysis Report`,
          executiveSummary: "Failed to generate.",
          keyMonthlyTrends: "Error.",
          agentTeamPerformance: "Error.",
          cohortAnalysis: "Error.",
          callHandlingEfficiency: "Error.",
          leadQualityAndFollowUp: "Error.",
          incentiveEffectiveness: "Error.",
          recommendationsWithDataBacking: [{area: "Error", recommendation: errorMessage, dataBacking: "N/A"}],
          limitationsAndDisclaimer: `An error occurred: ${errorMessage}`,
      };
      const errorItem: AnalysisReportResultItem = { // Updated type
          id: `${uniqueIdPrefix}-error`,
          userAnalysisPrompt: flowInput.userAnalysisPrompt,
          fileDetails: flowInput.fileDetails,
          error: errorMessage,
          analysisOutput: errorOutput
      };
      setAnalysisResult(errorItem); 
      
      logActivity({
        module: "Data Analysis", // Updated module name
        details: {
           inputData: flowInput,
           error: errorMessage,
           analysisOutput: errorOutput
        }
      });
      toast({
        variant: "destructive",
        title: `Error Generating Analysis`,
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Data Analyst" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <DataAnalysisForm
            onSubmit={handleGenerateAnalysis} 
            isLoading={isLoading}
            selectedFileCount={selectedFileCountInForm} 
        />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
             Generating your analysis report...
            </p>
          </div>
        )}
        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Input Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {!isLoading && analysisResult && (
           <div className="w-full max-w-4xl space-y-8 mt-8">
             <DataAnalysisResultsCard
               key={analysisResult.id}
               reportOutput={analysisResult.analysisOutput} // Pass the new prop name
               userAnalysisPrompt={analysisResult.userAnalysisPrompt}
               fileContext={analysisResult.fileDetails}
             />
           </div>
        )}
      </main>
    </div>
  );
}

    