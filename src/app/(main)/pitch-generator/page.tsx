
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
      // For non-text entries, just provide metadata. The AI is instructed to use this name/type.
      itemContext += `(This is a Knowledge Base file entry: Name='${file.name}', Type='${file.type}'. The AI should refer to its general knowledge or other text entries if specific content from this file is needed but not directly viewable here.)\n`;
    } else {
      itemContext += `(No textual content available for this item.)\n`;
    }
    itemContext += "--------------------------------------------------\n"; 
    
    // Check if adding this item would exceed the total length limit
    if (combinedContext.length + itemContext.length > MAX_TOTAL_CONTEXT_LENGTH) {
      itemContext = `...(further general KB items truncated due to total length limit)...\n--------------------------------------------------\n`;
      combinedContext += itemContext;
      break; // Stop adding more items
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

    if (!formData.product) {
      toast({ variant: "destructive", title: "Error", description: "Product must be selected."});
      setIsLoading(false);
      return;
    }

    let knowledgeBaseContextToUse: string;
    let contextSourceMessage: string;
    let usedDirectFileContext = false;

    if (directKbFileInfo) { 
        usedDirectFileContext = true;
        if (directKbContent) { // Content was successfully read from a plain text file
            knowledgeBaseContextToUse = `Primary Context from Directly Uploaded File:\n` +
                                        `  File Name: ${directKbFileInfo.name}\n` +
                                        `  File Type: ${directKbFileInfo.type}\n` +
                                        `Content:\n---\n${directKbContent}\n---`;
            contextSourceMessage = `Pitch generated using content from directly uploaded file: ${directKbFileInfo.name}.`;
            toast({
                title: "Using Direct File Content",
                description: `The content of ${directKbFileInfo.name} will be used as the knowledge base for this pitch.`,
                duration: 5000,
            });
        } else { // File was uploaded, but content couldn't be read (e.g. Word, PDF, or text file too large)
            knowledgeBaseContextToUse = `Primary Context from Directly Uploaded File:\n` +
                                        `  File Name: ${directKbFileInfo.name}\n` +
                                        `  File Type: ${directKbFileInfo.type}\n` +
                                        `Instructions for AI: This is a primary context file (e.g., DOCX, PDF, large text file). Its full text content was not pre-extracted on the client-side. You MUST prioritize information from this document if your model capabilities allow you to process its content based on its name, type, and the file itself. If direct processing is not possible, use its name and type as strong contextual cues. Synthesize information from this file to build the pitch. If unable, you may then refer to general knowledge and other parameters.`;
            contextSourceMessage = `Pitch context from uploaded file: ${directKbFileInfo.name}. AI instructed to attempt processing its content (type: ${directKbFileInfo.type}).`;
            toast({
                title: `Using Direct File: ${directKbFileInfo.name}`,
                description: `Type: ${directKbFileInfo.type}. AI will attempt to process its content. For plain text files, content is used directly.`,
                duration: 7000,
            });
        }
    } else { 
      // No direct file uploaded, use general KB
      knowledgeBaseContextToUse = prepareGeneralKnowledgeBaseContext(knowledgeBaseFiles, formData.product, formData.customerCohort);
      contextSourceMessage = "Pitch generated using general Knowledge Base.";
       if (knowledgeBaseContextToUse.startsWith("No specific knowledge base content found")) {
          toast({
            variant: "default",
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
      
      if (result.pitchTitle?.startsWith("Pitch Generation Failed") || result.pitchTitle?.startsWith("Pitch Generation Error") || result.pitchTitle?.startsWith("Pitch Generation Aborted")) {
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
            knowledgeBaseContextProvided: knowledgeBaseContextToUse !== "No specific knowledge base content found for this product in the general Knowledge Base." && !knowledgeBaseContextToUse.includes("Its content could not be directly read as text"),
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
        description: errorMessage.substring(0, 250),
        duration: 10000,
      });
      logActivity({
        module: "Pitch Generator",
        product: formData.product,
        details: {
          error: `Client-side error: ${errorMessage}`,
           inputData: { 
            product: formData.product as Product, 
            customerCohort: formData.customerCohort, 
            etPlanConfiguration: formData.etPlanConfiguration,
            salesPlan: formData.salesPlan,
            offer: formData.offer,
            agentName: formData.agentName,
            userName: formData.userName,
            knowledgeBaseContextProvided: knowledgeBaseContextToUse.length > 10 && !knowledgeBaseContextToUse.startsWith("No specific knowledge base content found") && !knowledgeBaseContextToUse.includes("Its content could not be directly read as text"),
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
            <AlertDescription>{error}</AlertDescription>
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
                    1. Select the target <strong>Product</strong> (ET or TOI).
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
                    <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-sm text-muted-foreground">
                        <li><strong>Option A (Default):</strong> If no "Direct Context File" is uploaded, the AI uses relevant entries from your main <strong>Knowledge Base</strong> for the selected product. Ensure your KB is populated for best results.</li>
                        <li><strong>Option B (Direct File):</strong> Upload a single file directly. 
                          For plain text files (.txt, .md, .csv up to 100KB), content is used directly. 
                          For Word documents (.doc, .docx) and other formats (PDFs etc.), the AI will be instructed to attempt to extract and use content from the file; its success may vary.
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
