
"use client";

import { useState } from 'react';
import { analyzeData } from '@/ai/flows/data-analyzer';
import type { DataAnalysisInput, DataAnalysisOutput } from '@/ai/flows/data-analyzer';
import { DataAnalysisForm, DataAnalysisFormValues } from '@/components/features/data-analysis/data-analysis-form';
import { DataAnalysisResultsCard } from '@/components/features/data-analysis/data-analysis-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';

export default function DataAnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<DataAnalysisOutput | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentUserDesc, setCurrentUserDesc] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const handleAnalyzeData = async (formData: DataAnalysisFormValues, fileContent: string | undefined) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    
    const file = formData.analysisFile[0];
    setCurrentFile(file);
    setCurrentUserDesc(formData.userDescription);

    try {
      const input: DataAnalysisInput = {
        fileName: file.name,
        fileType: file.type,
        fileContent: fileContent, // This will be undefined for non-text files or if reading failed
        userDescription: formData.userDescription,
      };

      const result = await analyzeData(input);
      setAnalysisResult(result);
      toast({
        title: "Data Analysis Complete!",
        description: `Analysis for ${file.name} has been generated.`,
      });
      logActivity({
        module: "Data Analysis",
        details: {
          inputData: {
            fileName: file.name,
            fileType: file.type,
            userDescription: formData.userDescription,
            // Not logging fileContent to keep activity log size manageable
          },
          analysisOutput: result,
        }
      });
    } catch (e) {
      console.error("Error analyzing data:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during analysis.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Analyzing Data",
        description: errorMessage,
      });
      logActivity({
        module: "Data Analysis",
        details: {
           inputData: {
            fileName: file.name,
            fileType: file.type,
            userDescription: formData.userDescription,
          },
          error: errorMessage,
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Data Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <DataAnalysisForm onSubmit={handleAnalyzeData} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Analyzing your data file...</p>
          </div>
        )}
        {error && !isLoading && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {analysisResult && !isLoading && (
          <DataAnalysisResultsCard 
            results={analysisResult} 
            fileName={currentFile?.name}
            userDescription={currentUserDesc}
          />
        )}
      </main>
    </div>
  );
}

    