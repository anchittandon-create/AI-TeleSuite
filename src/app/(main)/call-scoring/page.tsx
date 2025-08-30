
"use client";

import { useState, useId, ChangeEvent } from 'react';
import { CallScoringForm } from '@/components/features/call-scoring/call-scoring-form';
import { CallScoringResultsTable } from '@/components/features/call-scoring/call-scoring-results-table';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { fileToDataUrl } from '@/lib/file-utils';
import { scoreCall } from '@/ai/flows/call-scoring';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { ActivityLogEntry, Product, ScoreCallOutput, HistoricalScoreItem, KnowledgeFile, ProductObject } from '@/types';
import { useProductContext } from '@/hooks/useProductContext';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


interface CallScoringFormValues {
  inputType: "audio" | "text";
  audioFiles?: FileList;
  transcriptOverride?: string;
  agentName?: string;
  product?: string;
}

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Increase the timeout for this page and its server actions
export const maxDuration = 300; // 5 minutes

// Helper function to prepare Knowledge Base and Product context string
const prepareProductContext = (
  productObject: ProductObject,
  knowledgeBaseFiles: KnowledgeFile[],
): string => {
  let combinedContext = `Product Display Name: ${productObject.displayName}\n`;
  if (productObject.description) combinedContext += `Description: ${productObject.description}\n`;
  if (productObject.brandName) combinedContext += `Brand Name: ${productObject.brandName}\n`;
  if (productObject.brandUrl) combinedContext += `Brand URL: ${productObject.brandUrl}\n`;
  
  const productSpecificKb = knowledgeBaseFiles.filter(f => f.product === productObject.name);
  
  if (productSpecificKb.length > 0) {
      combinedContext += "\n--- Associated Knowledge Base Entries ---\n";
      productSpecificKb.forEach(file => {
          combinedContext += `\nItem: ${file.name}\nType: ${file.isTextEntry ? 'Text Entry' : file.type}\n`;
          if (file.isTextEntry && file.textContent) {
              combinedContext += `Content: ${file.textContent.substring(0, 2000)}...\n`;
          }
      });
  }
  return combinedContext;
};

// Simple delay helper function
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


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

  const handleAnalyzeCall = async (data: CallScoringFormValues) => {
    setIsLoading(true);
    setFormError(null);
    setResults([]);
    
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

    const productContext = prepareProductContext(productObject, knowledgeBaseFiles);

    const itemsToProcess: Array<{ name: string; file?: File; transcriptOverride?: string; }> = [];

    if (data.inputType === 'text') {
        if (!data.transcriptOverride || data.transcriptOverride.length < 50) {
            setFormError("A transcript of at least 50 characters is required.");
            setIsLoading(false);
            return;
        }
        itemsToProcess.push({ name: "Pasted Transcript", transcriptOverride: data.transcriptOverride });
    } else if (data.inputType === 'audio') {
        if (!data.audioFiles || data.audioFiles.length === 0) {
            setFormError("Please select at least one audio file.");
            setIsLoading(false);
            return;
        }
        for (const file of Array.from(data.audioFiles)) {
             if (file.size > MAX_AUDIO_FILE_SIZE) {
                setFormError(`File "${file.name}" exceeds the 100MB limit.`);
                setIsLoading(false);
                return;
            }
            itemsToProcess.push({ name: file.name, file });
        }
    }
    
    setTotalFiles(itemsToProcess.length);
    const initialResults: HistoricalScoreItem[] = itemsToProcess.map((item, index) => ({
      id: `${uniqueIdPrefix}-${item.name}-${index}`,
      timestamp: new Date().toISOString(),
      module: 'Call Scoring',
      product: product,
      agentName: data.agentName,
      details: {
        fileName: item.name,
        status: 'Queued',
      }
    }));
    setResults(initialResults);

    const completedActivitiesToLog = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const itemId = `${uniqueIdPrefix}-${item.name}-${i}`;
      let finalScoreOutput: ScoreCallOutput | null = null;
      let finalError: string | undefined = undefined;
      
      const updateResultStatus = (status: HistoricalScoreItem['details']['status'], updates: Partial<HistoricalScoreItem['details']> = {}) => {
        setResults(prev => prev.map(r => r.id === itemId ? { ...r, details: { ...r.details, ...updates, status } } : r));
      };
      
      setCurrentFileIndex(i + 1);
      
      try {
        let transcriptToScore: string;
        let transcriptAccuracy: string = "N/A";
        let audioDataUriForFinalResult: string | undefined;
        
        if (item.file) { 
          setCurrentStatus('Transcribing...');
          updateResultStatus('Transcribing');
          const audioDataUri = await fileToDataUrl(item.file);
          audioDataUriForFinalResult = audioDataUri;
          
          const transcriptResult = await transcribeAudio({ audioDataUri });
          
          if (transcriptResult.accuracyAssessment === "Error" || transcriptResult.diarizedTranscript.includes("[Transcription Error")) {
            throw new Error(`Transcription failed: ${transcriptResult.diarizedTranscript}`);
          }
          
          transcriptToScore = transcriptResult.diarizedTranscript;
          transcriptAccuracy = transcriptResult.accuracyAssessment;
        
        } else { 
          transcriptToScore = item.transcriptOverride!;
          transcriptAccuracy = "Provided as Text";
        }
        
        setCurrentStatus('Scoring...');
        updateResultStatus('Scoring', { audioDataUri: audioDataUriForFinalResult });
        
        const rawScoreOutput = await scoreCall({ product, agentName: data.agentName, transcriptOverride: transcriptToScore, productContext });

        // Manually add the transcript and accuracy back to the final object
        finalScoreOutput = {
          ...rawScoreOutput,
          transcript: transcriptToScore,
          transcriptAccuracy: transcriptAccuracy,
        };

        if (finalScoreOutput.callCategorisation === "Error") {
          throw new Error(finalScoreOutput.summary);
        }
        
        updateResultStatus('Complete', { scoreOutput: finalScoreOutput, audioDataUri: audioDataUriForFinalResult });
        
      } catch (e: any) {
        finalError = e.message || "An unknown error occurred.";
        
        finalScoreOutput = {
          transcript: `[Error processing ${item.name}. Raw Error: ${finalError}]`,
          transcriptAccuracy: "System Error",
          overallScore: 0,
          callCategorisation: "Error",
          summary: `Processing failed: ${finalError}`,
          strengths: [],
          areasForImprovement: [`Investigate and resolve the processing error.`],
          redFlags: [`System-level error during processing: ${finalError.substring(0,100)}...`],
          metricScores: [],
          improvementSituations: [],
        };
        updateResultStatus('Failed', { error: finalError, scoreOutput: finalScoreOutput });
        
        const lowerCaseError = finalError.toLowerCase();
        if (lowerCaseError.includes('429') || lowerCaseError.includes('quota') || lowerCaseError.includes('rate limit')) {
          toast({
            variant: 'destructive',
            title: 'API Rate Limit Reached',
            description: `The API is busy or the daily quota has been met. Stopping batch.`,
            duration: 7000,
          });
          completedActivitiesToLog.push({
            module: 'Call Scoring', product, agentName: data.agentName,
            details: { fileName: item.name, status: 'Failed', agentNameFromForm: data.agentName, scoreOutput: finalScoreOutput, error: finalError }
          });
          break; // Stop the whole batch on a quota error.
        }
      } finally {
         completedActivitiesToLog.push({
            module: 'Call Scoring', product, agentName: data.agentName,
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
                    1. Choose your input type: <strong>Upload Audio</strong> or <strong>Paste Transcript</strong>.
                </p>
                <p>
                    2. If uploading audio, you can select one or more files (up to 100MB each). The system will process them one by one.
                </p>
                 <p>
                    3. If pasting a transcript, get the text from the <strong>Audio Transcription</strong> page first.
                </p>
                <p>
                    4. Select a <strong>Product Focus</strong>. The AI uses the product's description and its linked Knowledge Base entries as context for scoring.
                </p>
                <p>
                    5. Optionally, enter the <strong>Agent Name</strong>.
                </p>
                <div>
                  <p>6. Click <strong>Score Call(s)</strong>. The process will start immediately. Please wait for it to complete. For large files, this may take a few minutes.</p>
                </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
