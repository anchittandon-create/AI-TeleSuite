
"use client";

import { useState } from 'react';
import { generateRebuttal } from '@/ai/flows/rebuttal-generator';
import type { GenerateRebuttalInput, GenerateRebuttalOutput } from '@/ai/flows/rebuttal-generator';
import { RebuttalForm, RebuttalFormValues } from '@/components/features/rebuttal-generator/rebuttal-form';
import { RebuttalDisplay } from '@/components/features/rebuttal-generator/rebuttal-display';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import type { KnowledgeFile, Product } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

  const handleGenerateRebuttal = async (data: RebuttalFormValues) => {
    setIsLoading(true);
    setError(null);
    setRebuttal(null);

    const productToUse = data.product as Product;

    if (!productToUse) {
      toast({ variant: "destructive", title: "Error", description: "Product must be selected."});
      setIsLoading(false);
      return;
    }
    
    const knowledgeBaseContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productToUse);

    if (knowledgeBaseContext === "No specific knowledge base content found for this product.") {
       toast({
        variant: "default",
        title: "Knowledge Base Incomplete",
        description: `No KB content found for ${productToUse}. AI may not be able to generate a tailored rebuttal.`,
      });
    }

    const fullInput: GenerateRebuttalInput = {
      ...data,
      product: productToUse,
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
        product: productToUse,
        details: { 
          rebuttalOutput: result,
          inputData: {objection: data.objection, product: productToUse, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product."}
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
        product: productToUse,
        details: {
          error: errorMessage,
          inputData: {objection: data.objection, product: productToUse, knowledgeBaseContextProvided: knowledgeBaseContext !== "No specific knowledge base content found for this product."}
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
            <p className="text-muted-foreground">Generating rebuttal using Knowledge Base...</p>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline text-sm">An error occurred. Click to see details.</AccordionTrigger>
                  <AccordionContent className="pt-2 text-xs">
                    <pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{error}</pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </AlertDescription>
          </Alert>
        )}
        {rebuttal && !isLoading && <RebuttalDisplay rebuttal={rebuttal} />}
      </main>
    </div>
  );
}
