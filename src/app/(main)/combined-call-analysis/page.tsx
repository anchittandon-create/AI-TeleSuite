
"use client";

import { useState, useMemo, useCallback } from 'react';
import { analyzeCallBatch, generateOptimizedPitches } from '@/ai/flows/combined-call-scoring-analysis';
import type { 
    CombinedCallAnalysisInput, CombinedCallAnalysisReportOutput, IndividualCallScoreDataItem, 
    ScoreCallOutput, Product, OptimizedPitchGenerationOutput, KnowledgeFile, ProductObject
} from '@/types';
import { CombinedCallAnalysisResultsCard } from '@/components/features/combined-call-analysis/combined-call-analysis-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, PieChart, Sparkles, Wand2, History, Trash2, ArrowRight, CheckSquare, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProductContext } from '@/hooks/useProductContext';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { OptimizedPitchesDialog } from '@/components/features/combined-call-analysis/optimized-pitches-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type StagedItemType = "Manual Score" | "Voice Agent Score";

interface StagedItem extends IndividualCallScoreDataItem {
    id: string;
    type: StagedItemType;
}

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

  const { toast } = useToast();
  const { logActivity, activities } = useActivityLogger();
  const { availableProducts, getProductByName } = useProductContext();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();

  const historicalReportsForProduct = useMemo(() => {
    if (!selectedProduct) return [];
    return (activities || [])
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
             return { id: activity.id, fileName, scoreOutput, type };
        }
        return null;
      }).filter((item): item is StagedItem => item !== null);
  }, [selectedProduct, activities]);
  
  const handleStageItem = (item: StagedItem) => {
    setStagedItems(prev => [...prev, item]);
  };

  const handleUnstageItem = (id: string) => {
    setStagedItems(prev => prev.filter(item => item.id !== id));
  };
  
  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setFormError(null);
    setCombinedReport(null);
    setOptimizedPitches(null);

    let itemsToAnalyze: StagedItem[] = [...stagedItems];

    try {
        if (itemsToAnalyze.length < 2) {
          throw new Error(`At least 2 valid reports are required for a combined analysis. Found ${itemsToAnalyze.length}.`);
        }

        setCurrentProcessMessage(`Found ${itemsToAnalyze.length} items. Generating combined analysis...`);

        const combinedInput: CombinedCallAnalysisInput = {
          callReports: itemsToAnalyze.map(({ id, type, ...rest }) => rest), // Remove UI-specific fields for the flow
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
      setIsPitchDialogOpen(true);
    }
  };
  
  return (
    <>
    <div className="flex flex-col h-full">
      <PageHeader title="Combined Call Scoring Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-4xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><PieChart className="mr-2 h-6 w-6 text-primary" /> Combined Call Analysis</CardTitle>
            <UiCardDescription>
                Select a product, then add historical reports from the left column to the staging area on the right to run an aggregated analysis.
            </UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <Label htmlFor="product-select">Product Focus <span className="text-destructive">*</span></Label>
                    <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v as string); setStagedItems([]); }}>
                    <SelectTrigger id="product-select"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analysis-goal">Specific Analysis Goal (Optional)</Label>
                  <Textarea id="analysis-goal" placeholder="e.g., 'Focus on why pricing objections are leading to lost sales'" rows={1} value={analysisGoal} onChange={(e) => setAnalysisGoal(e.target.value)} />
                </div>
              </div>
          </CardContent>
        </Card>
        
        {selectedProduct && (
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-md flex items-center"><History className="mr-2 h-5 w-5"/>Available Reports for '{getProductByName(selectedProduct)?.displayName}'</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 border rounded-md p-2">
                           {historicalReportsForProduct.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-4 text-center">No historical reports found for this product.</p>
                           ) : (
                               <div className="space-y-2">
                                {historicalReportsForProduct.map((item) => (
                                    <StagingRow 
                                        key={item.id} 
                                        item={item} 
                                        onAction={handleStageItem}
                                        actionType="stage"
                                        disabled={stagedItems.some(staged => staged.id === item.id)}
                                    />
                                ))}
                               </div>
                           )}
                        </ScrollArea>
                    </CardContent>
                </Card>
                <Card className="sticky top-20">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center"><CheckSquare className="mr-2 h-5 w-5 text-primary"/>Staged for Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 border rounded-md p-2 bg-muted/20">
                            {stagedItems.length === 0 ? (
                               <p className="text-sm text-muted-foreground p-4 text-center">Add at least 2 reports from the left to begin.</p>
                            ) : (
                                <div className="space-y-2">
                                {stagedItems.map((item) => (
                                    <StagingRow 
                                        key={item.id} 
                                        item={item} 
                                        onAction={handleUnstageItem}
                                        actionType="unstage"
                                    />
                                ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        )}

        <div className="w-full max-w-4xl">
          <Button onClick={handleRunAnalysis} className="w-full" disabled={isLoading || !selectedProduct || stagedItems.length < 2}>
            {isLoading ? <><LoadingSpinner className="mr-2"/>{currentProcessMessage || "Analyzing..."}</> : `Run Combined Analysis on ${stagedItems.length} Reports`}
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

const StagingRow = ({item, onAction, actionType, disabled}: {item: StagedItem, onAction: (itemOrId: any) => void, actionType: 'stage' | 'unstage', disabled?: boolean}) => {
    const score = item.scoreOutput?.overallScore?.toFixed(1) || 'N/A';
    return (
        <div className="flex justify-between items-center text-sm p-1.5 bg-background rounded-sm border">
            <div className="flex flex-col truncate pr-2">
                <span className="truncate text-xs font-medium" title={item.fileName}>{item.fileName}</span>
                <Badge variant={item.type === 'Manual Score' ? "outline" : "secondary"} className="w-fit text-[10px] mt-0.5">{item.type}</Badge>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Score: {score}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAction(actionType === 'stage' ? item : item.id)} disabled={disabled}>
                    {actionType === 'stage' ? <ArrowRight className="h-4 w-4 text-primary"/> : <X className="h-4 w-4 text-destructive"/>}
                </Button>
            </div>
        </div>
    );
};
