"use client";

import { useState } from 'react';
import { generateRebuttal } from '@/ai/flows/rebuttal-generator';
import { RebuttalForm, RebuttalFormValues } from '@/components/features/rebuttal-generator/rebuttal-form';
import { RebuttalDisplay } from '@/components/features/rebuttal-generator/rebuttal-display';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import type { KnowledgeFile, Product, ProductObject, GenerateRebuttalInput, GenerateRebuttalOutput } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useProductContext } from '@/hooks/useProductContext';


const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[] | undefined,
  productObject: ProductObject
): string => {
  if (!productObject || !Array.isArray(knowledgeBaseFiles)) {
    return "No product or knowledge base provided.";
  }

  const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === productObject.name);
  if (productSpecificFiles.length === 0) {
    return "No specific knowledge base content found for this product.";
  }
  
  const MAX_CONTEXT_LENGTH = 30000;
  let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT FOR PRODUCT: ${productObject.displayName} ---\n`;
  combinedContext += `Product Description: ${productObject.description || 'Not provided.'}\n`;
  if(productObject.brandName) combinedContext += `Brand Name: ${productObject.brandName}\n`;
  combinedContext += "--------------------------------------------------\n\n";

  const addSection = (title: string, files: KnowledgeFile[]) => {
      if (files.length > 0) {
          combinedContext += `--- ${title.toUpperCase()} ---\n`;
          files.forEach(file => {
              let itemContext = `\n--- Item: ${file.name} ---\n`;
              if (file.isTextEntry && file.textContent) {
                  itemContext += `Content:\n${file.textContent}\n`;
              } else {
                  itemContext += `(This is a reference to a ${file.type} file named '${file.name}'. The AI should infer context from its name, type, and category.)\n`;
              }
              if (combinedContext.length + itemContext.length <= MAX_CONTEXT_LENGTH) {
                  combinedContext += itemContext;
              }
          });
          combinedContext += `--- END ${title.toUpperCase()} ---\n\n`;
      }
  };
  
  const pitchDocs = productSpecificFiles.filter(f => f.category === 'Pitch');
  const productDescDocs = productSpecificFiles.filter(f => f.category === 'Product Description');
  const pricingDocs = productSpecificFiles.filter(f => f.category === 'Pricing');
  const rebuttalDocs = productSpecificFiles.filter(f => f.category === 'Rebuttals');
  const otherDocs = productSpecificFiles.filter(f => !f.category || !['Pitch', 'Product Description', 'Pricing', 'Rebuttals'].includes(f.category));

  addSection("COMMON OBJECTIONS & REBUTTALS (Prioritize for handling specific objections)", rebuttalDocs);
  addSection("PRODUCT DETAILS & PRICING (Prioritize for features, value, and cost-related objections)", [...productDescDocs, ...pricingDocs]);
  addSection("PITCH & SALES FLOW CONTEXT", pitchDocs);
  addSection("GENERAL SUPPLEMENTARY CONTEXT", otherDocs);


  if(combinedContext.length >= MAX_TOTAL_CONTEXT_LENGTH) {
    console.warn("Knowledge base context truncated due to length limit.");
    combinedContext += "\n... (Knowledge Base truncated due to length limit for AI context)\n";
  }

  combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
  return combinedContext.substring(0, MAX_TOTAL_CONTEXT_LENGTH);
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

    if (knowledgeBaseContext.includes("No specific knowledge base content found")) {
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
      brandUrl: productObject.brandUrl,
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
