
"use client";

import { useState } from 'react';
import { generatePitch } from '@/ai/flows/pitch-generator';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/ai/flows/pitch-generator';
import { PitchForm, PitchFormValues } from '@/components/features/pitch-generator/pitch-form'; // Import PitchFormValues
import { PitchCard } from '@/components/features/pitch-generator/pitch-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import type { KnowledgeFile, Product } from '@/types';

// Helper function to prepare Knowledge Base context string from general KB
const prepareGeneralKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product,
  customerCohort?: string
): string => {
  const productSpecificFiles = knowledgeBaseFiles.filter(
    (file) => file.product === product
  );

  if (productSpecificFiles.length === 0) {
    return "No specific knowledge base content found for this product in the general Knowledge Base.";
  }

  let combinedContext = "";
  const MAX_TOTAL_CONTEXT_LENGTH = 20000; 

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
    itemContext += "---\n"; 
    
    if (combinedContext.length + itemContext.length > MAX_TOTAL_CONTEXT_LENGTH) {
      itemContext = `...(further general KB items truncated due to total length limit)...\n---\n`;
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

  const handleGeneratePitch = async (formData: PitchFormValues, directKbContent?: string) => {
    setIsLoading(true);
    setError(null);
    setPitch(null);

    if (!formData.product) {
      toast({ variant: "destructive", title: "Error", description: "Product must be selected."});
      setIsLoading(false);
      return;
    }

    let knowledgeBaseContextToUse: string;
    let contextSourceMessage: string;

    if (directKbContent) {
      knowledgeBaseContextToUse = `Content from directly uploaded file for this pitch:\n---\n${directKbContent}\n---`;
      contextSourceMessage = `Pitch generated using directly uploaded file: ${formData.directKbFile?.[0]?.name || 'Uploaded File'}.`;
       toast({
        title: "Using Direct File for Context",
        description: `The content of ${formData.directKbFile?.[0]?.name || 'your uploaded file'} will be used as the knowledge base for this pitch.`,
        duration: 5000,
      });
    } else {
      knowledgeBaseContextToUse = prepareGeneralKnowledgeBaseContext(knowledgeBaseFiles, formData.product, formData.customerCohort);
      contextSourceMessage = "Pitch generated using general Knowledge Base.";
       if (knowledgeBaseContextToUse.startsWith("No specific knowledge base content found")) {
          toast({
            variant: "default", // Changed from destructive to default as AI will be informed
            title: "Knowledge Base Incomplete",
            description: `No general KB content found for ${formData.product}. AI will be informed and attempt generation with limited context.`,
            duration: 7000,
          });
       }
    }
    

    const fullInput: GeneratePitchInput = {
      product: formData.product,
      customerCohort: formData.customerCohort,
      etPlanConfiguration: formData.etPlanConfiguration,
      salesPlan: formData.salesPlan,
      offer: formData.offer,
      agentName: formData.agentName,
      userName: formData.userName,
      knowledgeBaseContext: knowledgeBaseContextToUse,
    };

    try {
      const result = await generatePitch(fullInput);
      setPitch(result);
      
      if (result.pitchTitle?.startsWith("Pitch Generation Failed") || result.pitchTitle?.startsWith("Pitch Generation Error")) {
         setError(null); 
         toast({
            variant: "destructive",
            title: result.pitchTitle || "Pitch Generation Failed",
            description: result.warmIntroduction || "The AI model encountered an issue. Please check the Knowledge Base, your direct file, or server logs.",
            duration: 10000, 
          });
      } else {
        toast({
            title: "Pitch Generated!",
            description: contextSourceMessage,
        });
      }
      logActivity({
        module: "Pitch Generator",
        product: formData.product,
        details: { 
          pitchOutput: result,
          inputData: {
            product: formData.product, 
            customerCohort: formData.customerCohort, 
            etPlanConfiguration: formData.etPlanConfiguration, 
            salesPlan: formData.salesPlan,
            offer: formData.offer,
            agentName: formData.agentName,
            userName: formData.userName,
            knowledgeBaseContextProvided: knowledgeBaseContextToUse !== "No specific knowledge base content found for this product in the general Knowledge Base." && knowledgeBaseContextToUse.length > 10,
            usedDirectFile: !!directKbContent,
            directFileName: directKbContent ? formData.directKbFile?.[0]?.name : undefined,
          }
        }
      });
    } catch (e) { 
      console.error("Error in PitchGeneratorPage handleGeneratePitch (client-side catch):", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred on the client side. Check console for details.";
      setError(errorMessage); 
      toast({
        variant: "destructive",
        title: "Client Error Generating Pitch",
        description: errorMessage.substring(0, 250),
        duration: 10000,
      });
      logActivity({
        module: "Pitch Generator",
        product: formData.product,
        details: {
          error: `Client-side error: ${errorMessage}`,
           inputData: {
            product: formData.product, 
            customerCohort: formData.customerCohort, 
            // ... (include other form fields)
            knowledgeBaseContextProvided: knowledgeBaseContextToUse.length > 10,
            usedDirectFile: !!directKbContent,
          }
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
        {error && !isLoading && ( 
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
