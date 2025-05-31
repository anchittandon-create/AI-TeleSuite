
"use client";

import { useState, useId } from 'react';
import { analyzeData } from '@/ai/flows/data-analyzer';
import type { DataAnalysisInput, DataAnalysisOutput } from '@/ai/flows/data-analyzer';
import { DataAnalysisForm, DataAnalysisFormValues } from '@/components/features/data-analysis/data-analysis-form';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisResultsTable, AnalyzedFileResultItem } from '@/components/features/data-analysis/data-analysis-results-table'; // New import
import type { ActivityLogEntry } from '@/types';


export default function DataAnalysisPage() {
  const [analysisResults, setAnalysisResults] = useState<AnalyzedFileResultItem[]>([]);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // For form-level errors
  const [processedFileCount, setProcessedFileCount] = useState(0);

  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger();
  const uniqueIdPrefix = useId();

  const handleAnalyzeData = async (formData: DataAnalysisFormValues, fileContents: (string | undefined)[]) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResults([]);
    setProcessedFileCount(0);
    
    const filesToProcess = Array.from(formData.analysisFiles);
    setCurrentFiles(filesToProcess);
    const allResults: AnalyzedFileResultItem[] = [];
    const activitiesToLog: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'agentName'>[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const fileContent = fileContents[i];
      setProcessedFileCount(i + 1);

      try {
        const input: DataAnalysisInput = {
          fileName: file.name,
          fileType: file.type,
          fileContent: fileContent,
          userDescription: formData.userDescription,
        };

        const result = await analyzeData(input);
        const resultItem: AnalyzedFileResultItem = {
            id: `${uniqueIdPrefix}-${file.name}-${i}`,
            fileName: file.name,
            userDescription: formData.userDescription,
            analysisOutput: result,
        };
        allResults.push(resultItem);
        
        activitiesToLog.push({
          module: "Data Analysis",
          details: {
            inputData: {
              fileName: file.name,
              fileType: file.type,
              userDescription: formData.userDescription,
            },
            analysisOutput: result,
          }
        });

      } catch (e) {
        console.error(`Error analyzing data for ${file.name}:`, e);
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during analysis.";
        const errorItem: AnalyzedFileResultItem = {
            id: `${uniqueIdPrefix}-${file.name}-${i}`,
            fileName: file.name,
            userDescription: formData.userDescription,
            error: errorMessage,
            analysisOutput: { // Provide a minimal structure for error cases
                analysisTitle: `Error Analyzing ${file.name}`,
                summary: "Analysis failed.",
                keyInsights: [],
                potentialPatterns: [],
            }
        };
        allResults.push(errorItem);

        activitiesToLog.push({
          module: "Data Analysis",
          details: {
             inputData: {
              fileName: file.name,
              fileType: file.type,
              userDescription: formData.userDescription,
            },
            error: errorMessage,
            analysisOutput: errorItem.analysisOutput
          }
        });
        toast({
          variant: "destructive",
          title: `Error Analyzing ${file.name}`,
          description: errorMessage,
        });
      }
    }

    if (activitiesToLog.length > 0) {
        logBatchActivities(activitiesToLog);
    }

    setAnalysisResults(allResults);
    setIsLoading(false);

    const successfulAnalyses = allResults.filter(r => !r.error).length;
    const failedAnalyses = allResults.length - successfulAnalyses;

    if (failedAnalyses === 0 && successfulAnalyses > 0) {
        toast({
            title: "Data Analysis Complete!",
            description: `Successfully analyzed ${successfulAnalyses} file(s).`,
        });
    } else if (successfulAnalyses > 0 && failedAnalyses > 0) {
        toast({
            title: "Partial Analysis Complete",
            description: `Analyzed ${successfulAnalyses} file(s) successfully, ${failedAnalyses} failed.`,
            variant: "default"
        });
    } else if (failedAnalyses > 0 && successfulAnalyses === 0) {
         toast({
            title: "Data Analysis Failed",
            description: `Could not analyze any of the ${failedAnalyses} selected file(s).`,
            variant: "destructive"
        });
    }
  };
  
  const selectedFileCount = (formValues?: DataAnalysisFormValues) => {
    return formValues?.analysisFiles?.length || 0;
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Data Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <DataAnalysisForm 
            onSubmit={handleAnalyzeData} 
            isLoading={isLoading} 
            selectedFileCount={currentFiles.length}
        />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
             {currentFiles.length > 1 ? `Analyzing file ${processedFileCount} of ${currentFiles.length}...` : 'Analyzing your data file...'}
            </p>
          </div>
        )}
        {error && !isLoading && ( // Form-level error display
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Form Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {analysisResults && analysisResults.length > 0 && !isLoading && (
           <DataAnalysisResultsTable results={analysisResults} />
        )}
      </main>
    </div>
  );
}
