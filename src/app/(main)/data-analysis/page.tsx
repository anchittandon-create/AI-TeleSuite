
"use client";

import { useState, useId } from 'react';
import { analyzeData } from '@/ai/flows/data-analyzer'; // This now points to generateDataAnalysisStrategy
import type { DataAnalysisInput, DataAnalysisOutput } from '@/ai/flows/data-analyzer'; // Types from the flow
import { DataAnalysisForm, DataAnalysisFormValues } from '@/components/features/data-analysis/data-analysis-form';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisResultsCard } from '@/components/features/data-analysis/data-analysis-results-card'; // Updated to display playbook
import type { ActivityLogEntry } from '@/types';

// This interface is for the page's state, holding one result if multiple files aren't iterated here.
// The form now handles the concept of "multiple files" as context for a single detailed prompt.
export interface AnalysisStrategyResultItem {
  id: string;
  userAnalysisPrompt: string;
  fileDetails: DataAnalysisInput['fileDetails'];
  analysisOutput: DataAnalysisOutput;
  error?: string;
}

export default function DataAnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisStrategyResultItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); 
  const [selectedFileCountInForm, setSelectedFileCountInForm] = useState(0);


  const { toast } = useToast();
  const { logActivity } = useActivityLogger(); // Use single logActivity
  const uniqueIdPrefix = useId();

  // The form's onSubmit now directly provides the DataAnalysisInput for the flow
  const handleGenerateStrategy = async (flowInput: DataAnalysisInput) => {
    setIsLoading(true);
    setFormError(null);
    setAnalysisResult(null); 
    
    // Update selected file count for button display, from the files submitted in form.
    // This is somewhat duplicated from the form itself but needed for the button text logic here if any.
    // Simpler approach: The form itself tracks its file count for its button.
    // This page's state `selectedFileCountInForm` could be removed if button text is fully managed by form.
    // For now, let's assume the `flowInput.fileDetails.length` is the count.
    setSelectedFileCountInForm(flowInput.fileDetails.length);


    try {
      const result = await analyzeData(flowInput); // Call the flow
      
      const resultItem: AnalysisStrategyResultItem = {
          id: `${uniqueIdPrefix}-strategy`,
          userAnalysisPrompt: flowInput.userAnalysisPrompt,
          fileDetails: flowInput.fileDetails,
          analysisOutput: result,
      };
      setAnalysisResult(resultItem);

      logActivity({ // Log single activity for the strategy generation
        module: "Data Analysis Strategy", // Updated module name
        details: {
          inputData: flowInput,
          analysisOutput: result,
        }
      });
      
      toast({
          title: "Analysis Strategy Generated!",
          description: "Your strategic playbook is ready.",
      });

    } catch (e) {
      console.error(`Error generating analysis strategy:`, e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during strategy generation.";
      
      // Construct a minimal error output matching the schema
      const errorOutput: DataAnalysisOutput = {
          analysisTitle: `Error Generating Strategy`,
          executiveSummary: "Failed to generate.",
          dataUnderstandingAndPreparationGuide: "Error.",
          keyMetricsAndKPIsToFocusOn: ["Error."],
          suggestedAnalyticalSteps: [{area: "Error", steps: errorMessage}],
          visualizationRecommendations: [],
          potentialDataIntegrityChecks: [],
          strategicRecommendationsForUser: [],
          topRevenueImprovementAreasToInvestigate: [],
          limitationsAndDisclaimer: `An error occurred: ${errorMessage}`,
      };
      const errorItem: AnalysisStrategyResultItem = {
          id: `${uniqueIdPrefix}-error`,
          userAnalysisPrompt: flowInput.userAnalysisPrompt,
          fileDetails: flowInput.fileDetails,
          error: errorMessage,
          analysisOutput: errorOutput
      };
      setAnalysisResult(errorItem); // Show the error in the results card area
      
      logActivity({
        module: "Data Analysis Strategy",
        details: {
           inputData: flowInput,
           error: errorMessage,
           analysisOutput: errorOutput
        }
      });
      toast({
        variant: "destructive",
        title: `Error Generating Strategy`,
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Data Analysis Strategist" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <DataAnalysisForm
            onSubmit={handleGenerateStrategy} // Updated to pass the flow's input type
            isLoading={isLoading}
            selectedFileCount={selectedFileCountInForm} // Let form manage its own count for its button if simpler
        />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
             Generating your analysis strategy...
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
           <div className="w-full max-w-4xl space-y-8 mt-8"> {/* Increased max-width for playbook */}
             <DataAnalysisResultsCard
               key={analysisResult.id}
               strategyOutput={analysisResult.analysisOutput} // Pass the new prop name
               userAnalysisPrompt={analysisResult.userAnalysisPrompt}
               fileContext={analysisResult.fileDetails}
             />
           </div>
        )}
      </main>
    </div>
  );
}

    