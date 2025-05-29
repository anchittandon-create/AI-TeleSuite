
"use client";

import { useState } from 'react';
import { generatePitch } from '@/ai/flows/pitch-generator';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/ai/flows/pitch-generator';
import { PitchForm } from '@/components/features/pitch-generator/pitch-form';
import { PitchCard } from '@/components/features/pitch-generator/pitch-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';

export default function PitchGeneratorPage() {
  const [pitch, setPitch] = useState<GeneratePitchOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const handleGeneratePitch = async (data: GeneratePitchInput) => {
    setIsLoading(true);
    setError(null);
    setPitch(null);
    try {
      const result = await generatePitch(data);
      setPitch(result);
      toast({
        title: "Pitch Generated!",
        description: "Your sales pitch has been successfully created.",
      });
      logActivity({
        module: "Pitch Generator",
        product: data.product,
        details: { // Log the full result object
          pitchOutput: result,
          inputData: data 
        }
      });
    } catch (e) {
      console.error("Error generating pitch:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Generating Pitch",
        description: errorMessage,
      });
      logActivity({
        module: "Pitch Generator",
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
      <PageHeader title="AI Pitch Generator" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <PitchForm onSubmit={handleGeneratePitch} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Generating your pitch...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {pitch && !isLoading && <PitchCard pitch={pitch} />}
      </main>
    </div>
  );
}
