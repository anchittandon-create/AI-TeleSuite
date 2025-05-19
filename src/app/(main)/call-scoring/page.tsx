
"use client";

import { useState } from 'react';
import { scoreCall } from '@/ai/flows/call-scoring';
import type { ScoreCallInput, ScoreCallOutput } from '@/ai/flows/call-scoring';
import { CallScoringForm, CallScoringFormValues } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';

export default function CallPerformancePage() { // Renamed page component
  const [results, setResults] = useState<ScoreCallOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setCurrentFileName(undefined);

    try {
      if (!data.audioFile || data.audioFile.length === 0) {
        throw new Error("Audio file is required.");
      }
      const audioFile = data.audioFile[0];
      setCurrentFileName(audioFile.name);
      const audioDataUri = await fileToDataUrl(audioFile);
      
      const input: ScoreCallInput = {
        audioDataUri,
        agentName: data.agentName,
      };

      const scoreOutput = await scoreCall(input);
      setResults(scoreOutput);
      toast({
        title: "Call Analyzed!",
        description: "The call has been successfully analyzed.",
      });
      logActivity({
        module: "Call Performance", // Updated module name
        agentName: data.agentName,
        details: `Analyzed call for agent ${data.agentName || 'Unknown'}. Overall Score: ${scoreOutput.overallScore}`,
      });
    } catch (e) {
      console.error("Error analyzing call:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Analyzing Call",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Call Performance Analysis" /> {/* Updated page title */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <CallScoringForm onSubmit={handleAnalyzeCall} isLoading={isLoading} submitButtonText="Analyze Call Performance" />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Analyzing call, this may take a moment...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {results && !isLoading && <CallScoringResultsCard results={results} fileName={currentFileName} />}
      </main>
    </div>
  );
}
