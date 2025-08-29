
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
import type { KnowledgeFile, Product, ProductObject } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useProductContext } from '@/hooks/useProductContext';


// Helper function to prepare Knowledge Base context string
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[],
  productObject: ProductObject
): string => {
  const productSpecificFiles = knowledgeBaseFiles.filter(
    (file) => file.product === productObject.name
  );
  
  let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT ---\n`;
  combinedContext += `Product Display Name: ${productObject.displayName}\n`;
  combinedContext += `Product Description: ${productObject.description || 'Not provided.'}\n`;
  if(productObject.brandName) combinedContext += `Brand Name: ${productObject.brandName}\n`;
  combinedContext += "--------------------------------------------------\n\n";

  const MAX_CONTEXT_LENGTH = 15000;

  if (productSpecificFiles.length === 0) {
      combinedContext += "No specific knowledge base files or text entries were found for this product.\n";
  } else {
    for (const file of productSpecificFiles) {
        let itemContext = `--- KB ITEM ---\n`;
        itemContext += `Name: ${file.name}\n`;
        itemContext += `Type: ${file.isTextEntry ? 'Text Entry' : file.type}\n`;
        if (file.persona) itemContext += `Relevant Persona: ${file.persona}\n`;
        
        itemContext += `Content:\n`;
        if (file.isTextEntry && file.textContent) {
        itemContext += `${file.textContent.substring(0, 3000)}\n`;
        if (file.textContent.length > 3000) itemContext += `...(content truncated)\n`;
        } else {
        itemContext += `(This is a file entry for a ${file.type} document. The AI should infer context from its name and type, as full binary content is not included here.)\n`;
        }
        itemContext += "--- END KB ITEM ---\n\n";
        
        if(combinedContext.length + itemContext.length > MAX_CONTEXT_LENGTH) {
            combinedContext += `...(further general KB items truncated due to total length limit)...\n`;
            break;
        }
        combinedContext += itemContext;
    }
  }
  combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
  return combinedContext;
};


export default function RebuttalGeneratorPage() {
  const [rebuttal, setRebuttal] = useState<GenerateRebuttalOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const { getProductByName } = useProductContext();

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
    
    const productObject = getProductByName(productToUse);
    if (!productObject) {
      toast({ variant: "destructive", title: "Error", description: "Selected product details not found."});
      setIsLoading(false);
      return;
    }
    
    const knowledgeBaseContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productObject);

    if (knowledgeBaseContext.includes("No specific knowledge base files or text entries were found")) {
       toast({
        variant: "default",
        title: "Knowledge Base Incomplete",
        description: `No KB content found for ${productToUse}. The AI will use a high-quality fallback algorithm to generate the rebuttal.`,
        duration: 7000
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
       if (result.rebuttal.startsWith("Cannot generate rebuttal:") || result.rebuttal.startsWith("Error generating rebuttal:")) {
         setError(result.rebuttal);
         setRebuttal(null);
         toast({
            variant: "destructive",
            title: "Rebuttal Generation Failed",
            description: "The AI returned an error. See details below.", 
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
          inputData: {objection: data.objection, product: productToUse, knowledgeBaseContextProvided: !knowledgeBaseContext.includes("No specific knowledge base content found")}
        }
      });
    } catch (e) {
      console.error("Error generating rebuttal:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error Generating Rebuttal",
        description: "An unexpected error occurred. See details below.",
      });
       logActivity({
        module: "Rebuttal Generator",
        product: productToUse,
        details: {
          error: errorMessage,
          inputData: {objection: data.objection, product: productToUse, knowledgeBaseContextProvided: !knowledgeBaseContext.includes("No specific knowledge base content found")}
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
        {error && !isLoading && (
          <Alert variant="destructive" className="mt-8 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Rebuttal Generation Error</AlertTitle>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline text-sm [&_svg]:ml-1">A generation error occurred. Click to view details.</AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{error}</pre>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Alert>
        )}
        {rebuttal && !isLoading && <RebuttalDisplay rebuttal={rebuttal} />}
      </main>
    </div>
  );
}
