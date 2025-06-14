
"use client";

import { useState, useId } from 'react';
import { analyzeData } from '@/ai/flows/data-analyzer'; 
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer';
import { DataAnalysisForm, DataAnalysisFormValues } from '@/components/features/data-analysis/data-analysis-form';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisResultsCard } from '@/components/features/data-analysis/data-analysis-results-card';
import type { ActivityLogEntry } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';


export interface AnalysisReportResultItem {
  id: string;
  userAnalysisPrompt: string;
  fileDetails: DataAnalysisInput['fileDetails'];
  analysisOutput: DataAnalysisReportOutput;
  error?: string;
}

export default function DataAnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisReportResultItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); 
  const [selectedFileCountInForm, setSelectedFileCountInForm] = useState(0);


  const { toast } = useToast();
  const { logActivity } = useActivityLogger(); 
  const uniqueIdPrefix = useId();

  const handleGenerateAnalysis = async (flowInput: DataAnalysisInput) => {
    setIsLoading(true);
    setFormError(null);
    setAnalysisResult(null); 
    
    setSelectedFileCountInForm(flowInput.fileDetails.length);

    try {
      const result = await analyzeData(flowInput); 
      
      const resultItem: AnalysisReportResultItem = {
          id: `${uniqueIdPrefix}-analysis`,
          userAnalysisPrompt: flowInput.userAnalysisPrompt,
          fileDetails: flowInput.fileDetails,
          analysisOutput: result,
      };
      setAnalysisResult(resultItem);

      logActivity({ 
        module: "Data Analysis",
        details: {
          inputData: flowInput,
          analysisOutput: result,
        }
      });
      
      if (result.reportTitle.startsWith("Data Analysis Failed") || result.reportTitle.startsWith("Critical System Error")) {
        toast({
            variant: "destructive",
            title: result.reportTitle,
            description: result.executiveSummary || "An AI error occurred during analysis.",
            duration: 7000,
        });
      } else {
        toast({
            title: "Data Analysis Complete!",
            description: "Your analysis report is ready.",
        });
      }


    } catch (e) {
      console.error(`Error generating analysis report:`, e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during analysis generation.";
      
      const errorOutput: DataAnalysisReportOutput = { 
          reportTitle: `Error Generating Analysis Report`,
          executiveSummary: "Failed to generate.",
          keyMetrics: [],
          detailedAnalysis: {
            dataReconstructionAndNormalizationSummary: "Error during analysis.",
            smartTableRecognitionSummary: "Error during analysis."
          },
          recommendations: [{area: "Error", recommendation: errorMessage, justification: "N/A"}],
          limitationsAndDisclaimer: `An error occurred: ${errorMessage}`,
      };
      const errorItem: AnalysisReportResultItem = {
          id: `${uniqueIdPrefix}-error`,
          userAnalysisPrompt: flowInput.userAnalysisPrompt,
          fileDetails: flowInput.fileDetails,
          error: errorMessage,
          analysisOutput: errorOutput
      };
      setAnalysisResult(errorItem); 
      
      logActivity({
        module: "Data Analysis",
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
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <DataAnalysisForm
            onSubmit={handleGenerateAnalysis} 
            isLoading={isLoading}
            selectedFileCount={selectedFileCountInForm} 
        />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
             Generating your analysis report...
            </p>
          </div>
        )}
        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Input Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {!isLoading && analysisResult && (
           <div className="w-full max-w-4xl space-y-6 mt-4">
             <DataAnalysisResultsCard
               key={analysisResult.id}
               reportOutput={analysisResult.analysisOutput}
               userAnalysisPrompt={analysisResult.userAnalysisPrompt}
               fileContext={analysisResult.fileDetails}
             />
           </div>
        )}
        {!isLoading && !analysisResult && !formError && (
          <Card className="w-full max-w-2xl shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-accent"/>
                    How the AI Data Analyst Works
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    The AI Data Analyst helps you derive insights from your data files (like Excel, CSVs, or text-based reports).
                    It <strong>does not directly process the full binary content</strong> of large files like Excel or PDFs. Instead, it intelligently works based on:
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                    <li><strong>Your Detailed Prompt:</strong> This is the most crucial input. Describe:
                        <ul className="list-circle list-inside pl-5 text-xs">
                            <li>The files you've "uploaded" (their names & types are context).</li>
                            <li>The likely structure of data within those files (e.g., sheet names, column headers, data types like numeric/text/date, date formats).</li>
                            <li>Any specific decoding rules for coded fields (e.g., "NR" = Not Reachable, "CALLB" = Call Back, "INT" = Interested).</li>
                            <li>Specific file mappings if relevant (e.g., "My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'").</li>
                            <li>Your specific analytical goals for *this* analysis run (e.g., "Focus on Q1 trends for conversion rates," "Identify top 3 performing agents based on revenue described in MIS").</li>
                            <li>Any known "messiness" in the data (e.g., misaligned headers, merged rows) so the AI can simulate cleaning steps.</li>
                        </ul>
                    </li>
                    <li><strong>File Metadata:</strong> The names and types of the files you "upload" are sent to the AI.</li>
                    <li><strong>Text Sample (Optional):</strong> If one of your primary files is a CSV or TXT, a small sample of its content (first ~10k characters) can be sent for more direct initial observations.</li>
                </ul>
                <p className="mt-2">
                    The AI then simulates data cleaning, interpretation, and analysis based on your textual descriptions to generate a comprehensive report covering trends, performance, and recommendations.
                </p>
                <p className="font-semibold mt-2 text-foreground">
                    The accuracy and depth of the analysis are directly proportional to the detail and clarity of your prompt.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
