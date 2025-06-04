
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
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import type { KnowledgeFile, Product } from '@/types';

// Helper function to prepare Knowledge Base context string
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product,
  customerCohort?: string // Optional, to potentially tailor context further if needed, though prompt focuses on product
): string => {
  const productSpecificFiles = knowledgeBaseFiles.filter(
    (file) => file.product === product
  );

  if (productSpecificFiles.length === 0) {
    return "No specific knowledge base content found for this product.";
  }

  return productSpecificFiles
    .map((file) => {
      let itemContext = `KB Item Name: ${file.name}\n`;
      itemContext += `Type: ${file.isTextEntry ? 'Text Entry' : file.type}\n`;
      if (file.persona) itemContext += `Target Persona: ${file.persona}\n`;
      
      itemContext += `Content:\n`;
      if (file.isTextEntry && file.textContent) {
        // Limit length per item to prevent overly large context strings for the AI
        itemContext += `${file.textContent.substring(0, 3000)}\n`; 
        if (file.textContent.length > 3000) itemContext += `...(content truncated)\n`;
      } else if (!file.isTextEntry) {
        itemContext += `(This is a file named '${file.name}'. Its content is referenced by its name and type for product '${product}'.)\n`;
      } else {
        itemContext += `(No textual content available for this item.)\n`;
      }
      return itemContext;
    })
    .join("---\n"); // Separator between items
};


export default function PitchGeneratorPage() {
  const [pitch, setPitch] = useState<GeneratePitchOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();

  const handleGeneratePitch = async (data: Omit<GeneratePitchInput, 'knowledgeBaseContext'>) => {
    setIsLoading(true);
    setError(null);
    setPitch(null);

    if (!data.product) {
      toast({ variant: "destructive", title: "Error", description: "Product must be selected."});
      setIsLoading(false);
      return;
    }

    const knowledgeBaseContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, data.product, data.customerCohort);
    
    if (knowledgeBaseContext === "No specific knowledge base content found for this product.") {
       toast({
        variant: "default",
        title: "Knowledge Base Incomplete",
        description: `No KB content found for ${data.product}. AI may not be able to generate a tailored pitch.`,
      });
    }

    const fullInput: GeneratePitchInput = {
      ...data,
      knowledgeBaseContext,
    };

    try {
      const result = await generatePitch(fullInput);
      setPitch(result);
      if (result.headlineHook === "Cannot Generate Pitch") {
         toast({
            variant: "destructive",
            title: "Pitch Generation Failed",
            description: result.introduction, // Contains reason for failure
          });
      } else {
        toast({
            title: "Pitch Generated!",
            description: "Your sales pitch has been successfully created using Knowledge Base content.",
        });
      }
      logActivity({
        module: "Pitch Generator",
        product: data.product,
        details: { 
          pitchOutput: result,
          inputData: {product: data.product, customerCohort: data.customerCohort, etPlanConfiguration: data.etPlanConfiguration, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product."} // Log context status
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
          inputData: {product: data.product, customerCohort: data.customerCohort, etPlanConfiguration: data.etPlanConfiguration, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product."}
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Pitch Generator (KB-Powered)" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <PitchForm onSubmit={handleGeneratePitch} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Generating your pitch using Knowledge Base...</p>
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
