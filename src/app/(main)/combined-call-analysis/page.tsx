
"use client";

import { useState, useMemo, useCallback } from 'react';
import { analyzeCallBatch, generateOptimizedPitches } from '@/ai/flows/combined-call-scoring-analysis';
import type { 
    CombinedCallAnalysisInput, CombinedCallAnalysisReportOutput, IndividualCallScoreDataItem, 
    ScoreCallOutput, Product, OptimizedPitchGenerationOutput, GeneratePitchOutput, KnowledgeFile, ProductObject
} from '@/types';
import { CombinedCallAnalysisResultsCard } from '@/components/features/combined-call-analysis/combined-call-analysis-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks, PieChart, Sparkles, Wand2, UploadCloud, History, Trash2, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription, CardFooter } from '@/components/ui/card';
import type { ActivityLogEntry, CombinedCallAnalysisActivityDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProductContext } from '@/hooks/useProductContext';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { OptimizedPitchesDialog } from '@/components/features/combined-call-analysis/optimized-pitches-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { transcribeAudio } from '@/ai/flows/transcription-flow';
import { scoreCall } from '@/ai/flows/call-scoring';

type AnalysisSource = "historical" | "audio_upload" | "report_upload";
type StagedItemType = "Manual Score" | "Voice Agent Score";

interface StagedItem extends IndividualCallScoreDataItem {
    type: StagedItemType;
}

// Helper for preparing knowledge base context
const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[] | undefined,
  productObject: ProductObject
): string => {
  if (!knowledgeBaseFiles || !Array.isArray(knowledgeBaseFiles)) return "Knowledge Base not yet loaded.";
  const productSpecificFiles = knowledgeBaseFiles.filter(f => f.product === productObject.name);
  if (productSpecificFiles.length === 0) return "No specific knowledge base content found for this product.";
  
  const MAX_CONTEXT_LENGTH = 15000;
  let combinedContext = `Knowledge Base Context for Product: ${productObject.displayName}\n---\n`;
  for (const file of productSpecificFiles) {
    let contentToInclude = `(File: ${file.name}, Type: ${file.type}. Content not directly viewed for non-text or large files; AI should use name/type as context.)`;
    if (file.isTextEntry && file.textContent) {
        contentToInclude = file.textContent.substring(0,2000) + (file.textContent.length > 2000 ? "..." : "");
    }
    const itemContent = `Item: ${file.name}\nType: ${file.isTextEntry ? 'Text Entry' : 'File'}\nContent Summary/Reference:\n${contentToInclude}\n---\n`;
    if (combinedContext.length + itemContent.length > MAX_CONTEXT_LENGTH) {
        combinedContext += "... (Knowledge Base truncated due to length limit for AI context)\n";
        break;
    }
    combinedContext += itemContent;
  }
  return combinedContext;
};


export default function CombinedCallAnalysisPage() {
  const [combinedReport, setCombinedReport] = useState<CombinedCallAnalysisReportOutput | null>(null);
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
  const [currentProcessMessage, setCurrentProcessMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>();
  const [analysisGoal, setAnalysisGoal] = useState('');
  const [optimizedPitches, setOptimizedPitches] = useState<OptimizedPitchGenerationOutput | null>(null);
  const [isPitchDialogOpen, setIsPitchDialogOpen] = useState(false);
  
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>("historical");
  const [uploadedAudioFiles, setUploadedAudioFiles] = useState<File[]>([]);
  const [uploadedReportFiles, setUploadedReportFiles] = useState<File[]>([]);

  const { toast } = useToast();
  const { logActivity, activities } = useActivityLogger();
  const { availableProducts, getProductByName } = useProductContext();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();

  const handleStageHistoricalData = useCallback(() => {
    if (!selectedProduct) {
      toast({ variant: 'destructive', title: 'Product not selected' });
      return;
    }
    setCurrentProcessMessage("Fetching historical call scores...");
    const historicalScores: StagedItem[] = (activities || [])
      .filter(activity =>
        ((activity.module === "Call Scoring" && activity.details.scoreOutput) ||
         ((activity.module === "AI Voice Sales Agent" || activity.module === "Browser Voice Agent" || activity.module === "AI Voice Support Agent") && activity.details.finalScore)) &&
        (activity.product === selectedProduct || (activity.details.input?.product === selectedProduct || activity.details.flowInput?.product === selectedProduct)) &&
        activity.details && typeof activity.details === 'object'
      )
      .map(activity => {
        let scoreOutput: ScoreCallOutput | undefined;
        let fileName: string;
        let type: StagedItemType;
        
        if (activity.module === "Call Scoring") {
          scoreOutput = (activity.details as any).scoreOutput;
          fileName = (activity.details as any).fileName;
          type = "Manual Score";
        } else {
          scoreOutput = (activity.details as any).finalScore;
          fileName = `Voice Call - ${(activity.details as any).input?.userName || (activity.details as any).flowInput?.userName || 'User'}`;
          type = "Voice Agent Score";
        }
        
        if (scoreOutput && scoreOutput.callCategorisation !== "Error" && fileName) {
             return { fileName, scoreOutput, type };
        }
        return null;
      }).filter((item): item is StagedItem => item !== null);

      if (historicalScores.length < 2) {
          toast({ variant: 'destructive', title: 'Not Enough Data', description: `Found only ${historicalScores.length} historical reports for ${selectedProduct}. At least 2 are needed.` });
          return;
      }
      
      setStagedItems(historicalScores);
      toast({ title: 'Data Staged', description: `Staged ${historicalScores.length} historical reports for analysis.` });
      setCurrentProcessMessage("");
  }, [selectedProduct, activities, toast]);
  
  const handleRemoveStagedItem = (fileName: string) => {
    setStagedItems(prev => prev.filter(item => item.fileName !== fileName));
  };
  
  const processUploadedFiles = async (): Promise<StagedItem[]> => {
      if (!selectedProduct) throw new Error("Product must be selected.");
      
      const productObject = getProductByName(selectedProduct);
      if (!productObject) throw new Error("Could not find product details.");

      const productContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productObject);
      const processedItems: StagedItem[] = [];

      if (analysisSource === 'audio_upload' && uploadedAudioFiles.length > 0) {
          for (const file of uploadedAudioFiles) {
              setCurrentProcessMessage(`Processing audio: ${file.name}...`);
              const audioDataUri = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = e => resolve(e.target?.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              const { diarizedTranscript } = await transcribeAudio({ audioDataUri });
              const scoreOutput = await scoreCall({ product: selectedProduct as Product, transcriptOverride: diarizedTranscript, productContext, audioDataUri });
              processedItems.push({ fileName: file.name, scoreOutput, type: 'Manual Score' });
          }
      } else if (analysisSource === 'report_upload' && uploadedReportFiles.length > 0) {
          for (const file of uploadedReportFiles) {
              setCurrentProcessMessage(`Processing report: ${file.name}...`);
              const transcriptOverride = await file.text();
              const scoreOutput = await scoreCall({ product: selectedProduct as Product, transcriptOverride, productContext });
              processedItems.push({ fileName: file.name, scoreOutput, type: 'Manual Score' });
          }
      }
      return processedItems;
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setFormError(null);
    setCombinedReport(null);
    setOptimizedPitches(null);

    let itemsToAnalyze: StagedItem[] = [...stagedItems];

    try {
        if (analysisSource !== 'historical' && itemsToAnalyze.length === 0) {
            itemsToAnalyze = await processUploadedFiles();
        }
        
        if (itemsToAnalyze.length < 2) {
          throw new Error(`At least 2 valid reports or files are required for a combined analysis. Found ${itemsToAnalyze.length}.`);
        }

        setStagedItems(itemsToAnalyze); // Update staging area with processed files
        setCurrentProcessMessage(`Found ${itemsToAnalyze.length} items. Generating combined analysis...`);

        const combinedInput: CombinedCallAnalysisInput = {
          callReports: itemsToAnalyze.map(({ type, ...rest }) => rest), // Remove 'type' for the flow
          product: selectedProduct!,
          overallAnalysisGoal: analysisGoal
        };

        const finalReport = await analyzeCallBatch(combinedInput);
        setCombinedReport(finalReport);
        if (finalReport.reportTitle.startsWith("Error:") || finalReport.reportTitle.startsWith("Critical Error:")) {
          throw new Error(finalReport.batchExecutiveSummary || "The AI returned an error during combined analysis.");
        } else {
          toast({ title: "Combined Analysis Complete!", description: "Aggregated report is ready." });
        }

        logActivity({
            module: "Combined Call Analysis",
            product: selectedProduct,
            details: { input: combinedInput, output: finalReport }
        });

    } catch (e: any) {
      const errorMessage = e.message || "Unknown error during analysis.";
      setFormError(`Analysis failed: ${errorMessage}`);
      toast({ variant: "destructive", title: "Analysis Failed", description: errorMessage });
    } finally {
      setIsLoading(false);
      setCurrentProcessMessage("");
    }
  };

  const handleGenerateOptimizedPitches = async (selectedCohorts: string[]) => {
    if (!combinedReport || !selectedProduct) {
      toast({ variant: 'destructive', title: 'Error', description: 'A combined report must be generated first.' });
      return;
    }
    
    const productObject = getProductByName(selectedProduct);
    if (!productObject) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected product details not found.' });
      return;
    }

    setIsGeneratingPitches(true);
    try {
      const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productObject);
      const result = await generateOptimizedPitches({
        product: selectedProduct,
        cohortsToOptimize: selectedCohorts,
        analysisReport: combinedReport,
        knowledgeBaseContext: kbContext,
      });

      if (!result || !result.optimizedPitches || result.optimizedPitches.some(p => p.pitch.pitchTitle.includes("Failed"))) {
        const errorPitch = result?.optimizedPitches.find(p => p.pitch.pitchTitle.includes("Failed"));
        throw new Error(errorPitch?.pitch.warmIntroduction || "An unexpected error occurred during pitch generation.");
      }

      setOptimizedPitches(result);
      toast({ title: 'Pitches Generated!', description: `Optimized pitches for ${selectedCohorts.length} cohort(s) are ready.` });

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Pitch Generation Failed', description: e.message, duration: 8000 });
      setOptimizedPitches(null);
    } finally {
      setIsGeneratingPitches(false);
      setIsPitchDialogOpen(true); // Open dialog even on failure to show error pitches
    }
  };
  
  return (
    <>
    <div className="flex flex-col h-full">
      <PageHeader title="Combined Call Scoring Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><PieChart className="mr-2 h-6 w-6 text-primary" /> Combined Call Analysis</CardTitle>
            <UiCardDescription>
                Aggregate insights from multiple calls. Choose to analyze historical reports or upload files directly.
            </UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-select">Product Focus <span className="text-destructive">*</span></Label>
                <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v as string)}>
                  <SelectTrigger id="product-select"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Analysis Source</Label>
                <RadioGroup value={analysisSource} onValueChange={(v) => setAnalysisSource(v as AnalysisSource)} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="historical" id="src-hist" /><Label htmlFor="src-hist">Historical Data</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="audio_upload" id="src-audio" /><Label htmlFor="src-audio">Upload Audio</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="report_upload" id="src-report" /><Label htmlFor="src-report">Upload Reports</Label></div>
                </RadioGroup>
              </div>

              {analysisSource === 'historical' && (
                  <Button onClick={handleStageHistoricalData} variant="outline" className="w-full" disabled={!selectedProduct}>
                      <History className="mr-2 h-4 w-4"/> Stage Historical Data for {selectedProduct || "..."}
                  </Button>
              )}
              {analysisSource === 'audio_upload' && (
                  <div><Label htmlFor="audio_upload">Audio Files (MP3, WAV, etc.)</Label><Input id="audio_upload" type="file" multiple accept="audio/*" onChange={e => setUploadedAudioFiles(Array.from(e.target.files || []))} className="mt-1 pt-1.5" /></div>
              )}
              {analysisSource === 'report_upload' && (
                  <div><Label htmlFor="report_upload">Report Files (.txt, .md, etc.)</Label><Input id="report_upload" type="file" multiple accept="text/*,.md" onChange={e => setUploadedReportFiles(Array.from(e.target.files || []))} className="mt-1 pt-1.5" /></div>
              )}

               <div className="space-y-2">
                  <Label htmlFor="analysis-goal">Specific Analysis Goal (Optional)</Label>
                  <Textarea id="analysis-goal" placeholder="e.g., 'Focus on why pricing objections are leading to lost sales'" rows={2} value={analysisGoal} onChange={(e) => setAnalysisGoal(e.target.value)} />
              </div>
          </CardContent>
        </Card>
        
        {stagedItems.length > 0 && (
            <Card className="w-full max-w-2xl">
                <CardHeader><CardTitle className="text-md flex items-center"><CheckSquare className="mr-2 h-5 w-5"/>Staged for Analysis ({stagedItems.length})</CardTitle></CardHeader>
                <CardContent>
                    <ScrollArea className="h-40 border rounded-md p-2">
                       <div className="space-y-2">
                         <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Manually Scored Calls</p>
                            {stagedItems.filter(i => i.type === "Manual Score").map((item, index) => (
                                <StagedItemRow key={`manual-${index}`} item={item} onRemove={handleRemoveStagedItem} />
                            ))}
                            {stagedItems.filter(i => i.type === "Manual Score").length === 0 && <p className="text-xs text-muted-foreground p-1">None</p>}
                         </div>
                         <div>
                            <p className="text-xs font-semibold text-muted-foreground mt-2 mb-1">Voice Agent Interactions</p>
                            {stagedItems.filter(i => i.type === "Voice Agent Score").map((item, index) => (
                                <StagedItemRow key={`agent-${index}`} item={item} onRemove={handleRemoveStagedItem} />
                            ))}
                            {stagedItems.filter(i => i.type === "Voice Agent Score").length === 0 && <p className="text-xs text-muted-foreground p-1">None</p>}
                         </div>
                       </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        )}

        <div className="w-full max-w-2xl">
          <Button onClick={handleRunAnalysis} className="w-full" disabled={isLoading || !selectedProduct || (stagedItems.length < 2 && analysisSource === 'historical')}>
            {isLoading ? <><LoadingSpinner className="mr-2"/>{currentProcessMessage || "Analyzing..."}</> : `Run Combined Analysis`}
          </Button>
        </div>

        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <Accordion type="single" collapsible className="w-full"><AccordionItem value="item-1" className="border-b-0"><AccordionTrigger className="p-0 hover:no-underline text-sm [&_svg]:ml-1">Details</AccordionTrigger><AccordionContent className="pt-2"><pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{formError}</pre></AccordionContent></AccordionItem></Accordion>
          </Alert>
        )}
        {combinedReport && !isLoading && (
          <>
            <CombinedCallAnalysisResultsCard report={combinedReport} individualScores={stagedItems} />
            <Card className="w-full max-w-5xl">
                <CardFooter className="pt-6 border-t">
                  <div className="w-full flex flex-col items-center gap-2">
                    <p className="text-sm font-semibold text-primary">Turn Insights into Action!</p>
                    <Button onClick={() => setIsPitchDialogOpen(true)} variant="default" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground" disabled={isGeneratingPitches}>
                        {isGeneratingPitches ? <LoadingSpinner size={16} className="mr-2"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                        {isGeneratingPitches ? 'Generating Optimized Pitches...' : 'Generate Optimized Pitches from This Analysis'}
                    </Button>
                  </div>
                </CardFooter>
            </Card>
          </>
        )}
      </main>
    </div>
    {combinedReport && (
        <OptimizedPitchesDialog
            isOpen={isPitchDialogOpen}
            onClose={() => setIsPitchDialogOpen(false)}
            product={selectedProduct!}
            optimizedPitches={optimizedPitches}
            onSubmit={handleGenerateOptimizedPitches}
            isLoading={isGeneratingPitches}
        />
    )}
    </>
  );
}

const StagedItemRow = ({item, onRemove}: {item: StagedItem, onRemove: (name: string) => void}) => {
    return (
        <div className="flex justify-between items-center text-sm p-1 bg-background rounded-sm">
            <span className="truncate pr-2">{item.fileName}</span>
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Score: {item.scoreOutput?.overallScore?.toFixed(1) || 'N/A'}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(item.fileName)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </div>
        </div>
    );
};

