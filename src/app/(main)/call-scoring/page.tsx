
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

export default function CallScoringPage() {
  const [results, setResults] = useState<ScoreCallOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const handleScoreCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      if (!data.audioFile || data.audioFile.length === 0) {
        throw new Error("Audio file is required.");
      }
      const audioDataUri = await fileToDataUrl(data.audioFile[0]);
      
      const input: ScoreCallInput = {
        audioDataUri,
        agentName: data.agentName,
      };

      const scoreOutput = await scoreCall(input);
      setResults(scoreOutput);
      toast({
        title: "Call Scored!",
        description: "The call has been successfully analyzed.",
      });
      logActivity({
        module: "Call Scoring",
        agentName: data.agentName,
        details: `Scored call for agent ${data.agentName || 'Unknown'}. Score: ${scoreOutput.score}`,
      });
    } catch (e) {
      console.error("Error scoring call:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Scoring Call",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Call Scoring" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <CallScoringForm onSubmit={handleScoreCall} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Analyzing call...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {results && !isLoading && <CallScoringResultsCard results={results} />}
      </main>
    </div>
  );
}
