
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
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import type { KnowledgeFile, Product } from '@/types';
import { useProductContext } from '@/hooks/useProductContext';

// Helper function to prepare Knowledge Base context string
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  product: Product
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
        itemContext += `(This is a Knowledge Base file entry for '${file.name}' with type '${file.type}', associated with product '${product}'. The full content of this file is not included in this context string; use its name, type, and other provided text entries for relevant information.)\n`;
      } else {
        itemContext += `(No textual content available for this item.)\n`;
      }
      return itemContext;
    })
    .join("---\n"); // Separator between items
};


export default function RebuttalGeneratorPage() {
  const [rebuttal, setRebuttal] = useState<GenerateRebuttalOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const { selectedProduct } = useProductContext();

  const handleGenerateRebuttal = async (data: Omit<GenerateRebuttalInput, 'knowledgeBaseContext' | 'product'>) => {
    setIsLoading(true);
    setError(null);
    setRebuttal(null);

    if (!selectedProduct) {
      toast({ variant: "destructive", title: "Error", description: "Product must be selected."});
      setIsLoading(false);
      return;
    }
    
    const knowledgeBaseContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, selectedProduct as Product);

    if (knowledgeBaseContext === "No specific knowledge base content found for this product.") {
       toast({
        variant: "default",
        title: "Knowledge Base Incomplete",
        description: `No KB content found for ${selectedProduct}. AI may not be able to generate a tailored rebuttal.`,
      });
    }

    const fullInput: GenerateRebuttalInput = {
      ...data,
      product: selectedProduct as Product,
      knowledgeBaseContext,
    };

    try {
      const result = await generateRebuttal(fullInput);
      setRebuttal(result);
       if (result.rebuttal.startsWith("Cannot generate rebuttal:")) {
         toast({
            variant: "destructive",
            title: "Rebuttal Generation Failed",
            description: result.rebuttal, 
          });
      } else {
        toast({
            title: "Rebuttal Generated!",
            description: "Suggested rebuttal has been successfully created using Knowledge Base content.",
        });
      }
      logActivity({
        module: "Rebuttal Generator",
        product: selectedProduct,
        details: { 
          rebuttalOutput: result,
          inputData: {objection: data.objection, product: selectedProduct, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product."}
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
        product: selectedProduct,
        details: {
          error: errorMessage,
          inputData: {objection: data.objection, product: selectedProduct, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product."}
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={`AI Rebuttal Assistant - ${selectedProduct}`} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
        <RebuttalForm onSubmit={handleGenerateRebuttal} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Generating rebuttal using Knowledge Base...</p>
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
