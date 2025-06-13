
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

  // Concatenate content, ensuring a reasonable overall length for the context
  let combinedContext = "";
  const MAX_TOTAL_CONTEXT_LENGTH = 20000; // Max total length for combined KB context

  for (const file of productSpecificFiles) {
    let itemContext = `KB Item Name: ${file.name}\n`;
    itemContext += `Type: ${file.isTextEntry ? 'Text Entry' : file.type}\n`;
    if (file.persona) itemContext += `Target Persona: ${file.persona}\n`;
    
    itemContext += `Content:\n`;
    if (file.isTextEntry && file.textContent) {
      itemContext += `${file.textContent.substring(0, 3000)}\n`; 
      if (file.textContent.length > 3000) itemContext += `...(content truncated for this item)\n`;
    } else if (!file.isTextEntry) {
      itemContext += `(This is a Knowledge Base file entry for '${file.name}' with type '${file.type}', associated with product '${product}'. The full content of this file is not included in this context string; use its name, type, and other provided text entries for relevant information.)\n`;
    } else {
      itemContext += `(No textual content available for this item.)\n`;
    }
    itemContext += "---\n"; // Separator between items
    
    if (combinedContext.length + itemContext.length > MAX_TOTAL_CONTEXT_LENGTH) {
      itemContext = `...(further KB items truncated due to total length limit)...\n---\n`;
      combinedContext += itemContext;
      break; 
    }
    combinedContext += itemContext;
  }
  return combinedContext;
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
      // Allow proceeding, as the flow itself handles this specific message for a graceful AI response.
    }

    const fullInput: GeneratePitchInput = {
      ...data,
      knowledgeBaseContext,
    };

    try {
      const result = await generatePitch(fullInput);
      setPitch(result);
      
      // Check for specific error titles/content returned by the flow
      if (result.pitchTitle?.startsWith("Pitch Generation Failed") || result.pitchTitle?.startsWith("Pitch Generation Error")) {
         toast({
            variant: "destructive",
            title: result.pitchTitle || "Pitch Generation Failed",
            description: result.warmIntroduction || "The AI model encountered an issue. Please check the Knowledge Base or try again.",
            duration: 7000, // Longer duration for error messages
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
          inputData: {product: data.product, customerCohort: data.customerCohort, etPlanConfiguration: data.etPlanConfiguration, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product." && knowledgeBaseContext.length > 10}
        }
      });
    } catch (e) { // This catch is for network errors or if generatePitch itself throws unexpectedly
      console.error("Error in PitchGeneratorPage handleGeneratePitch:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred on the client side.";
      setError(errorMessage); // Display a generic error message in the UI if needed
      toast({
        variant: "destructive",
        title: "Client Error Generating Pitch",
        description: errorMessage,
        duration: 7000,
      });
      logActivity({
        module: "Pitch Generator",
        product: data.product,
        details: {
          error: `Client-side error: ${errorMessage}`,
          inputData: {product: data.product, customerCohort: data.customerCohort, etPlanConfiguration: data.etPlanConfiguration, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product." && knowledgeBaseContext.length > 10 }
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
        {error && !isLoading && ( // Display error if set by client-side catch
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Pitch Generation Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {pitch && !isLoading && <PitchCard pitch={pitch} />}
      </main>
    </div>
  );
}
