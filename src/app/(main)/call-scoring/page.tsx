
"use client";

import { useState, useId } from 'react';
import { CallScoringForm } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsTable } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { scoreCall } from '@/ai/flows/call-scoring';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { ActivityLogEntry, Product, ScoreCallOutput, HistoricalScoreItem, KnowledgeFile, ProductObject, TranscriptionOutput } from '@/types';
import { useProductContext } from '@/hooks/useProductContext';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BatchProgressList, BatchProgressItem } from '@/components/common/batch-progress-list';
import { MAX_AUDIO_FILE_SIZE_MB, MAX_AUDIO_FILE_SIZE_BYTES } from '@/config/media';
import { upload } from '@vercel/blob/client';
import { fileToDataUri } from '@/lib/file-utils';
import { uploadAudioFile } from '@/lib/blob-upload';


interface CallScoringFormValues {
  audioFiles?: FileList;
  agentName?: string;
  product?: string;
}

// Increase the timeout for this page and its server actions
export const maxDuration = 300; // 5 minutes (Vercel Hobby limit)

// Helper function to prepare Knowledge Base and Product context string
const prepareKnowledgeBaseContext = (
  productObject: ProductObject,
  knowledgeBaseFiles: KnowledgeFile[],
): string => {
  if (!productObject || !Array.isArray(knowledgeBaseFiles)) {
    return "No product or knowledge base provided.";
  }

  const productSpecificFiles = knowledgeBaseFiles.filter(
    (file) => file.product === productObject.name
  );
  
  const MAX_CONTEXT_LENGTH = 30000;
  let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT FOR PRODUCT: ${productObject.displayName} ---\n`;
  combinedContext += `Brand Name: ${productObject.brandName || 'Not provided'}\n`;
  combinedContext += `Brand URL: ${productObject.brandUrl || 'Not provided'}\n`;
  combinedContext += `Description: ${productObject.description || 'Not provided'}\n`;
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

  addSection("PRODUCT DETAILS, FEATURES, & PRICING (Source for factual information)", [...productDescDocs, ...pricingDocs]);
  addSection("COMMON OBJECTIONS & REBUTTALS (Source for handling objections)", rebuttalDocs);
  addSection("PITCH & SALES FLOW CONTEXT (Source for call structure and narrative)", pitchDocs);
  addSection("GENERAL SUPPLEMENTARY CONTEXT", otherDocs);


  if(combinedContext.length >= MAX_CONTEXT_LENGTH) {
    console.warn("Knowledge base context truncated due to length limit.");
    combinedContext += "\n... (Knowledge Base truncated due to length limit for AI context)\n";
  }

  combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
  return combinedContext.substring(0, MAX_CONTEXT_LENGTH);
};

export default function CallScoringPage() {
  const [results, setResults] = useState<HistoricalScoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();
  const { logBatchActivities } = useActivityLogger();
  const { getProductByName } = useProductContext();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();
  const uniqueIdPrefix = useId();
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [progressItems, setProgressItems] = useState<BatchProgressItem[]>([]);

  const updateProgress = (id: string, updates: Partial<BatchProgressItem>) => {
    setProgressItems(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setFormError(null);
    setResults([]);
    setProgressItems([]);
    
    const product = data.product as Product | undefined;
    if (!product) {
      setFormError("Product selection is required.");
      setIsLoading(false);
      return;
    }
    
    const productObject = getProductByName(product);
    if (!productObject) {
       setFormError("Selected product could not be found in the catalog.");
       setIsLoading(false);
       return;
    }

    const productContext = prepareKnowledgeBaseContext(productObject, knowledgeBaseFiles);

    const itemsToProcess = data.audioFiles ? Array.from(data.audioFiles) : [];

    if (itemsToProcess.length === 0) {
      setFormError("Please provide at least one audio file to analyze.");
      setIsLoading(false);
      return;
    }

    for (const file of itemsToProcess) {
      if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
        setFormError(`File "${file.name}" exceeds the ${MAX_AUDIO_FILE_SIZE_MB}MB limit.`);
        setIsLoading(false);
        return;
      }
    }

    setTotalFiles(itemsToProcess.length);
    const initialResults: HistoricalScoreItem[] = itemsToProcess.map((file, index) => ({
      id: `${uniqueIdPrefix}-${file.name}-${index}`,
      timestamp: new Date().toISOString(),
      module: 'Call Scoring',
      product: product,
      agentName: data.agentName,
      details: {
        fileName: file.name,
        status: 'Queued',
        audioDataUri: undefined,
      }
    }));
    setResults(initialResults);
    setProgressItems(initialResults.map(item => ({
      id: item.id,
      fileName: item.details.fileName,
      step: 'Queued',
      status: 'queued',
      progress: 0,
      message: 'Waiting to start transcription',
    })));

    const completedActivitiesToLog: ActivityLogEntry[] = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const itemId = `${uniqueIdPrefix}-${item.name}-${i}`;
      let finalScoreOutput: ScoreCallOutput | null = null;
      let finalError: string | undefined = undefined;
      
      const updateResultStatus = (status: HistoricalScoreItem['details']['status'], updates: Partial<HistoricalScoreItem['details']> = {}) => {
        setResults(prev => prev.map(r => r.id === itemId ? { ...r, details: { ...r.details, ...updates, status } } : r));
      };
      
      setCurrentFileIndex(i + 1);
      updateProgress(itemId, {
        step: 'Transcribing audio',
        status: 'running',
        progress: 20,
        message: 'Uploading audio & requesting transcript',
      });
      
      try {
        // Step 1: Upload the file to Vercel Blob storage
        updateProgress(itemId, {
          step: 'Uploading audio',
          status: 'running',
          progress: 10,
          message: 'Securely uploading file...',
        });
        const blob = await upload(item.name, item, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        });

        // Step 2: Transcription using the public URL
        setCurrentStatus('Transcribing...');
        updateResultStatus('Transcribing');
        updateProgress(itemId, {
          step: 'Transcribing audio',
          status: 'running',
          progress: 25,
          message: 'File uploaded, starting transcription from URL.',
        });
        
        const transcriptionResult = await transcribeAudio({ audioUrl: blob.url });

        if (!transcriptionResult || typeof transcriptionResult !== 'object') {
          throw new Error('Transcription failed: Received empty response from AI service.');
        }

        const { diarizedTranscript } = transcriptionResult;
        const accuracyAssessment = transcriptionResult.accuracyAssessment || "Assessment not provided.";

        if (!diarizedTranscript || typeof diarizedTranscript !== 'string' || !diarizedTranscript.trim()) {
          throw new Error('Transcription failed: AI service returned an empty transcript.');
        }

        updateProgress(itemId, {
          step: 'Analyzing transcript',
          status: 'running',
          progress: 55,
          message: 'Transcription complete, preparing scoring request',
        });

        if (accuracyAssessment === "Error" || diarizedTranscript.includes("[Transcription Error")) {
          throw new Error(`Transcription failed: ${diarizedTranscript}`);
        }

        // Step 3: Scoring using the public URL
        setCurrentStatus('Scoring...');
        updateResultStatus('Scoring');

        finalScoreOutput = await scoreCall({ 
          product, 
          agentName: data.agentName, 
          audioUrl: blob.url,
          transcriptOverride: diarizedTranscript,
          productContext,
          brandUrl: productObject.brandUrl,
        });
        updateProgress(itemId, {
          step: 'Scoring insights',
          status: 'running',
          progress: 85,
          message: 'Aggregating rubric scores and insights',
        });

        // Ensure the final transcript from scoring is the one from the transcription step.
        finalScoreOutput.transcript = diarizedTranscript;
        finalScoreOutput.transcriptAccuracy = accuracyAssessment;

        if (finalScoreOutput.callCategorisation === "Error") {
          throw new Error(finalScoreOutput.summary);
        }
        
        updateResultStatus('Complete', { scoreOutput: finalScoreOutput });
        updateProgress(itemId, {
          step: 'Completed',
          status: 'success',
          progress: 100,
          message: `Overall score: ${finalScoreOutput.overallScore?.toFixed?.(1) || finalScoreOutput.overallScore}`,
        });
        
      } catch (e: any) {
        console.error(`[AI-Telesuite] Critical error processing file: ${item.name}. Full error object:`, e);
        finalError = e.message || "An unexpected error occurred.";
        
        finalScoreOutput = {
          transcript: (e.message?.includes("Transcription failed:") ? e.message : `[Error processing ${item.name}. Raw Error: ${finalError}]`),
          transcriptAccuracy: "System Error",
          overallScore: 0, callCategorisation: "Error", summary: `Processing failed: ${finalError}`,
          strengths: [], areasForImprovement: [`Investigate and resolve the processing error.`],
          redFlags: [`System-level error during processing: ${finalError.substring(0,100)}...`],
          metricScores: [], improvementSituations: [], conversionReadiness: 'Low', suggestedDisposition: "Error"
        };
        updateResultStatus('Failed', { error: finalError, scoreOutput: finalScoreOutput });
        updateProgress(itemId, {
          step: 'Failed',
          status: 'failed',
          progress: 100,
          message: finalError,
        });
        
        const lowerCaseError = finalError.toLowerCase();
        if (lowerCaseError.includes('429') || lowerCaseError.includes('quota') || lowerCaseError.includes('rate limit')) {
          toast({
            variant: 'destructive', title: 'API Rate Limit Reached',
            description: `The AI is busy or the daily quota has been met. Stopping batch.`, duration: 7000,
          });
          completedActivitiesToLog.push({
            id: itemId, module: 'Call Scoring', product, agentName: data.agentName, timestamp: new Date().toISOString(),
            details: { fileName: item.name, status: 'Failed', agentNameFromForm: data.agentName, scoreOutput: finalScoreOutput, error: finalError }
          });
          break; // Stop the whole batch on a quota error.
        }
      } finally {
         completedActivitiesToLog.push({
            id: itemId, module: 'Call Scoring', product, agentName: data.agentName, timestamp: new Date().toISOString(),
            details: {
              fileName: item.name, status: finalError ? 'Failed' : 'Complete',
              agentNameFromForm: data.agentName, scoreOutput: finalScoreOutput, error: finalError
            }
         });
      }
    }
    
    // Batch log all completed activities at once
    if (completedActivitiesToLog.length > 0) {
      logBatchActivities(completedActivitiesToLog);
    }

    setIsLoading(false);
    setCurrentStatus('');
    toast({ title: "All jobs finished or stopped", description: `Finished processing all submitted item(s). Check table for results.` });
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Call Scoring" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        {progressItems.length > 0 && (
          <BatchProgressList
            items={progressItems}
            description="Each file moves through transcription and scoring steps."
          />
        )}
        <CallScoringForm 
          onSubmit={handleAnalyzeCall} 
          isLoading={isLoading} 
        />
        {isLoading && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground">
              {totalFiles > 1 ? `Processing ${currentFileIndex} of ${totalFiles}: ${currentStatus}` : `${currentStatus || 'Processing...'}`}
            </p>
          </div>
        )}
        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>An Error Occurred</AlertTitle>
             <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline text-sm [&_svg]:ml-1">A validation error occurred. Click to view details.</AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{formError}</pre>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Alert>
        )}
        {results.length > 0 && (
          <CallScoringResultsTable results={results} />
        )}
         {results.length === 0 && !isLoading && !formError && (
          <Card className="w-full max-w-lg shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <ListChecks className="h-5 w-5 mr-2 text-accent"/>
                    How to Use AI Call Scoring
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    1. Upload one or more audio files (up to {MAX_AUDIO_FILE_SIZE_MB}MB each). The system will process them one by one.
                </p>
                <p>
                    2. Select a <strong>Product Focus</strong>. The AI uses the product's description and its linked Knowledge Base entries as context for scoring.
                </p>
                <p>
                    3. Optionally, enter the <strong>Agent Name</strong>.
                </p>
                <div>
                  <p>4. Click <strong>Score Call(s)</strong>. The process will start immediately. The AI will first transcribe the audio and then score it based on both the content and tonality. Please wait for it to complete. For large files, this may take a few minutes.</p>
                </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

    
