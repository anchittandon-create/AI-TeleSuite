
"use client";

import { useState } from 'react';
import { generateRebuttal } from '@/ai/flows/rebuttal-generator';
import type { GenerateRebuttalInput, GenerateRebuttalOutput } from '@/ai/flows/rebuttal-generator';
import { RebuttalForm } from '@/components/features/rebuttal-generator/rebuttal-form';
import { RebuttalDisplay } from '@/components/features/rebuttal-generator/rebuttal-display';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';

export default function RebuttalGeneratorPage() {
  const [rebuttal, setRebuttal] = useState<GenerateRebuttalOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const handleGenerateRebuttal = async (data: GenerateRebuttalInput) => {
    setIsLoading(true);
    setError(null);
    setRebuttal(null);
    try {
      const result = await generateRebuttal(data);
      setRebuttal(result);
      toast({
        title: "Rebuttal Generated!",
        description: "Suggested rebuttal has been successfully created.",
      });
      logActivity({
        module: "Rebuttal Generator",
        product: data.product,
        details: { // Log the full result object
          rebuttalOutput: result,
          inputData: data
        }
      });
    } catch (e) {
      console.error("Error generating rebuttal:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Generating Rebuttal",
        description: errorMessage,
      });
       logActivity({
        module: "Rebuttal Generator",
        product: data.product,
        details: {
          error: errorMessage,
          inputData: data
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Rebuttal Assistant" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <RebuttalForm onSubmit={handleGenerateRebuttal} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Generating rebuttal...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {rebuttal && !isLoading && <RebuttalDisplay rebuttal={rebuttal} />}
      </main>
    </div>
  );
}
