
"use client";

import { useState } from 'react';
import { generatePitch } from '@/ai/flows/pitch-generator';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/ai/flows/pitch-generator';
import { PitchForm, PitchFormValues } from '@/components/features/pitch-generator/pitch-form'; 
import { PitchCard } from '@/components/features/pitch-generator/pitch-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Lightbulb, InfoIcon } from 'lucide-react'; // Added Lightbulb
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import type { KnowledgeFile, Product } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


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

  let combinedContext = `Knowledge Base Content for Product: ${product}\n`;
  if (customerCohort) {
    combinedContext += `Target Customer Cohort: ${customerCohort}\n`;
  }
  combinedContext += "--------------------------------------------------\n";
  
  const MAX_TOTAL_CONTEXT_LENGTH = 20000; // Max total length for the combined context

  for (const file of productSpecificFiles) {
    let itemContext = `Source Item Name: ${file.name}\n`;
    itemContext += `Type: ${file.isTextEntry ? 'Text Entry' : file.type}\n`;
    if (file.persona) itemContext += `Relevant Persona: ${file.persona}\n`;
    
    itemContext += `Content:\n`;
    if (file.isTextEntry && file.textContent) {
      itemContext += `${file.textContent.substring(0, 3000)}\n`; // Limit length per item
      if (file.textContent.length > 3000) itemContext += `...(content truncated for this item)\n`;
    } else if (!file.isTextEntry) {
      itemContext += `(This is a Knowledge Base file entry: Name='${file.name}', Type='${file.type}'. The AI should refer to its general knowledge or other text entries if specific content from this file is needed but not directly viewable here.)\n`;
    } else {
      itemContext += `(No textual content available for this item.)\n`;
    }
    itemContext += "--------------------------------------------------\n"; 
    
    if (combinedContext.length + itemContext.length > MAX_TOTAL_CONTEXT_LENGTH) {
      itemContext = `...(further general KB items truncated due to total length limit)...\n--------------------------------------------------\n`;
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

  const handleGeneratePitch = async (formData: PitchFormValues, directKbContent?: string, directKbFileInfo?: {name: string, type: string}) => {
    setIsLoading(true);
    setError(null);
    setPitch(null);

    const productToUse = formData.product as Product;

    if (!productToUse) {
      toast({ variant: "destructive", title: "Error", description: "Product must be selected."});
      setIsLoading(false);
      return;
    }

    let knowledgeBaseContextToUse: string;
    let contextSourceMessage: string;
    let usedDirectFileContext = false;
    
    const generalKbContent = prepareGeneralKnowledgeBaseContext(knowledgeBaseFiles, productToUse, formData.customerCohort);

    if (directKbFileInfo) { 
        usedDirectFileContext = true;
        let directFileInstructions = `--- START OF UPLOADED FILE CONTEXT (PRIMARY SOURCE) ---\n`;
        directFileInstructions += `File Name: ${directKbFileInfo.name}\n`;
        directFileInstructions += `File Type: ${directKbFileInfo.type}\n`;
        directFileInstructions += `Instruction to AI: This uploaded file ('${directKbFileInfo.name}') is the PRIMARY knowledge source for this pitch. `;
        
        if (directKbContent) {
            directFileInstructions += `Its plain text content (up to 100KB) is provided below. Utilize this content directly.\n`;
            directFileInstructions += `--- BEGIN UPLOADED FILE CONTENT ---\n${directKbContent}\n--- END UPLOADED FILE CONTENT ---\n`;
            contextSourceMessage = `Pitch generated using content from directly uploaded file: ${directKbFileInfo.name}.`;
            toast({
                title: "Using Direct File Content",
                description: `The content of ${directKbFileInfo.name} will be used as the primary knowledge base.`,
                duration: 5000,
            });
        } else { 
            directFileInstructions += `The full content of this file (type: ${directKbFileInfo.type}) was not read client-side. You MUST attempt to extract and utilize relevant information from THIS document based on its name and type using your capabilities. `;
            directFileInstructions += `If you cannot directly process the content of this specific file type, clearly state that this specific file could not be read by you, and then proceed to generate the best possible pitch using the file's metadata (name, type) and any fallback general KB content (if provided below). Prioritize what you can infer from this file's metadata and type.`;
            contextSourceMessage = `Pitch context from uploaded file: ${directKbFileInfo.name} (Type: ${directKbFileInfo.type}). AI instructed to attempt processing its content.`;
             toast({
                title: `Using Direct File: ${directKbFileInfo.name}`,
                description: `Type: ${directKbFileInfo.type}. AI will attempt to process its content.`,
                duration: 7000,
            });
        }
        directFileInstructions += `--- END OF UPLOADED FILE CONTEXT ---\n\n`;
        knowledgeBaseContextToUse = directFileInstructions + (generalKbContent === "No specific knowledge base content found for this product in the general Knowledge Base." ? "" : generalKbContent);

    } else { 
      knowledgeBaseContextToUse = generalKbContent;
      contextSourceMessage = "Pitch generated using general Knowledge Base.";
       if (knowledgeBaseContextToUse.startsWith("No specific knowledge base content found")) {
          toast({
            variant: "default",
            title: "Knowledge Base Incomplete",
            description: `No general KB content found for ${productToUse}. AI will be informed and attempt generation with limited context.`,
            duration: 7000,
          });
       }
    }
    
    const fullInput: GeneratePitchInput = {
      product: productToUse,
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
      
      if (result.pitchTitle?.startsWith("Pitch Generation Failed") || result.pitchTitle?.startsWith("Pitch Generation Error") || result.pitchTitle?.startsWith("Pitch Generation Aborted")) {
         setError(result.warmIntroduction);
         setPitch(null);
         toast({
            variant: "destructive",
            title: result.pitchTitle || "Pitch Generation Failed",
            description: "The AI model encountered an issue. See error details below.",
            duration: 10000, 
          });
      } else {
        setPitch(result);
        toast({
            title: "Pitch Generated!",
            description: contextSourceMessage,
        });
      }

      const { knowledgeBaseContext, ...inputForLogging } = fullInput;
      
      logActivity({
        module: "Pitch Generator",
        product: productToUse,
        details: { 
          pitchOutput: result,
          inputData: { 
            ...inputForLogging,
            knowledgeBaseContextProvided: knowledgeBaseContext.length > 100 && !knowledgeBaseContext.startsWith("No specific knowledge base content found"),
            usedDirectFile: usedDirectFileContext,
            directFileName: directKbFileInfo?.name,
            directFileContentUsed: !!directKbContent, 
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
        description: "An unexpected error occurred. See details below.",
        duration: 10000,
      });

      const { knowledgeBaseContext, ...inputForLoggingOnError } = fullInput;

      logActivity({
        module: "Pitch Generator",
        product: productToUse,
        details: {
          error: `Client-side error: ${errorMessage}`,
           inputData: { 
            ...inputForLoggingOnError,
            knowledgeBaseContextProvided: knowledgeBaseContext.length > 100 && !knowledgeBaseContext.startsWith("No specific knowledge base content found"),
            usedDirectFile: usedDirectFileContext,
            directFileName: directKbFileInfo?.name,
            directFileContentUsed: !!directKbContent,
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
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <PitchForm onSubmit={handleGeneratePitch} isLoading={isLoading} />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">Generating your pitch...</p>
          </div>
        )}
        {error && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Pitch Generation Error</AlertTitle>
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
        {pitch && !isLoading && <PitchCard pitch={pitch} />}
        {!pitch && !isLoading && !error && (
          <Card className="w-full max-w-lg shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <Lightbulb className="h-5 w-5 mr-2 text-accent"/>
                    How to Use the Pitch Generator
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    1. Select the <strong>Product</strong> you are creating a pitch for.
                </p>
                <p>
                    2. Choose the <strong>Customer Cohort</strong> to tailor the pitch.
                </p>
                <p>
                    3. Optionally, expand "Optional Personalization Details" to specify <strong>ET Plan Configuration</strong> (if ET is selected), <strong>Sales Plan</strong>, <strong>Offer Details</strong>, <strong>Agent Name</strong>, and <strong>Customer Name</strong>.
                </p>
                <p>
                    4. For knowledge context:
                </p>
                   <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                        <li><strong>Option A (Default):</strong> If no "Direct Context File" is uploaded, the AI uses relevant entries from your main <strong>Knowledge Base</strong> for the selected product. Ensure your KB is populated for best results.</li>
                        <li><strong>Option B (Direct File):</strong> Upload a single file (PDF, DOCX, TXT, etc.). 
                          For plain text files (.txt, .md, .csv up to 100KB), content is used directly. 
                          For Word documents, PDFs, etc., the AI will be instructed to attempt to use the file's content (name/type are primary context); success may vary.
                          This direct file context, if provided, is prioritized.
                        </li>
                    </ul>
                <p>
                    5. Click <strong>Generate Pitch</strong>. The AI will craft a pitch including an introduction, product explanation, benefits, and a call to action.
                </p>
                <p className="mt-3 font-semibold text-foreground">
                    The generated pitch script will be displayed, along with its components, ready for review, copying, or downloading.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
