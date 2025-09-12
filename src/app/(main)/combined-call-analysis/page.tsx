
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
import { Terminal, PieChart, Sparkles, Wand2, History, Trash2, ArrowRight, CheckSquare, X, Info, Bot, Mic, Check } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';


type StagedItemType = "Manual Score" | "Voice Agent Score";
type SourceFilterType = "All" | StagedItemType;


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
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
  const [currentProcessMessage, setCurrentProcessMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>();
  const [analysisGoal, setAnalysisGoal] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>("All");
  const [optimizedPitches, setOptimizedPitches] = useState<OptimizedPitchGenerationOutput | null>(null);
  const [isPitchDialogOpen, setIsPitchDialogOpen] = useState(false);

  const { toast } = useToast();
  const { logActivity, activities } = useActivityLogger();
  const { availableProducts, getProductByName } = useProductContext();
  const { files: knowledgeBaseFiles } = useKnowledgeBase();

  const historicalReportsForProduct = useMemo(() => {
    if (!selectedProduct) return [];
    
    const allReports = (activities || [])
      .filter(activity =>
        ((activity.module === "Call Scoring" && activity.details.scoreOutput) ||
         ((activity.module === "AI Voice Sales Agent" || activity.module === "Browser Voice Agent") && activity.details.finalScore)) &&
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
             if (!scoreOutput.timestamp) {
                scoreOutput.timestamp = activity.timestamp;
             }
             return { id: activity.id, fileName, scoreOutput, type };
        }
        return null;
      }).filter((item): item is StagedItem => item !== null)
      .sort((a, b) => {
        const dateA = a.scoreOutput?.timestamp ? new Date(a.scoreOutput.timestamp).getTime() : 0;
        const dateB = b.scoreOutput?.timestamp ? new Date(b.scoreOutput.timestamp).getTime() : 0;
        return dateB - dateA;
      });

      if (sourceFilter === "All") {
        return allReports;
      }
      return allReports.filter(report => report.type === sourceFilter);

  }, [selectedProduct, activities, sourceFilter]);
  
  // When product or filter changes, clear selection
  useCallback(() => {
    setSelectedReportIds([]);
  }, [selectedProduct, sourceFilter]);

  
  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setFormError(null);
    setCombinedReport(null);
    setOptimizedPitches(null);

    const itemsToAnalyze: StagedItem[] = historicalReportsForProduct.filter(item => selectedReportIds.includes(item.id));

    try {
        if (itemsToAnalyze.length < 2) {
          throw new Error(`At least 2 valid reports are required for a combined analysis. You have selected ${itemsToAnalyze.length}.`);
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

      if (!result || !result.optimizedPitches || result.optimizedPitches.some(p => p.pitch.pitchTitle.includes("Error"))) {
        const errorPitch = result?.optimizedPitches.find(p => p.pitch.pitchTitle.includes("Error"));
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
            <CardTitle className="text-xl flex items-center">
                <PieChart className="mr-2 h-6 w-6 text-primary" />
                <span>Configure Analysis</span>
            </CardTitle>
            <UiCardDescription>
                Select a product and set an optional goal to begin your combined analysis.
            </UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <Label htmlFor="product-select" className="font-semibold">Step 1: Select Product Focus <span className="text-destructive">*</span></Label>
                    <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v as string); setSelectedReportIds([]); setCombinedReport(null); }}>
                    <SelectTrigger id="product-select"><SelectValue placeholder="Select a product" /></SelectTrigger>
                    <SelectContent>{availableProducts.map((p) => (<SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analysis-goal" className="font-semibold">Step 2: Set Analysis Goal (Optional)</Label>
                  <Textarea id="analysis-goal" placeholder="e.g., 'Focus on why pricing objections are leading to lost sales'" rows={1} value={analysisGoal} onChange={(e) => setAnalysisGoal(e.target.value)} />
                </div>
              </div>
          </CardContent>
        </Card>
        
        {selectedProduct && (
            <Card className="w-full max-w-4xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg font-semibold flex items-center">
                        Step 3: Select Reports for Analysis
                        </CardTitle>
                        <UiCardDescription>
                        Choose at least 2 historical reports to include in the combined analysis.
                        </UiCardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="source-filter" className="text-sm">Source:</Label>
                        <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilterType)}>
                            <SelectTrigger id="source-filter" className="w-[200px]">
                                <SelectValue placeholder="Filter by source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Sources</SelectItem>
                                <SelectItem value="Manual Score"><div className='flex items-center'><Mic className='w-4 h-4 mr-2'/>Manual Score</div></SelectItem>
                                <SelectItem value="Voice Agent Score"><div className='flex items-center'><Bot className='w-4 h-4 mr-2'/>Voice Agent Score</div></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <ReportSelectionTable
                  reports={historicalReportsForProduct}
                  selectedIds={selectedReportIds}
                  onSelectionChange={setSelectedReportIds}
                />
              </CardContent>
              <CardFooter className="bg-muted/50 border-t px-6 py-4">
                <Button onClick={handleRunAnalysis} className="w-full text-base py-6" disabled={isLoading || !selectedProduct || selectedReportIds.length < 2}>
                  {isLoading ? <><LoadingSpinner className="mr-2"/>{currentProcessMessage || "Analyzing..."}</> : `Run Combined Analysis on ${selectedReportIds.length} Reports`}
                </Button>
              </CardFooter>
            </Card>
        )}

        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <Accordion type="single" collapsible className="w-full"><AccordionItem value="item-1" className="border-b-0"><AccordionTrigger className="p-0 hover:no-underline text-sm [&_svg]:ml-1">Details</AccordionTrigger><AccordionContent className="pt-2"><pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{formError}</pre></AccordionContent></AccordionItem></Accordion>
          </Alert>
        )}
        
        {combinedReport && !isLoading && (
          <>
            <Separator className="w-full max-w-4xl my-4" />
            <CombinedCallAnalysisResultsCard 
                report={combinedReport} 
                individualScores={historicalReportsForProduct.filter(item => selectedReportIds.includes(item.id))} 
            />
            <Card className="w-full max-w-5xl">
                <CardFooter className="pt-6">
                  <div className="w-full flex flex-col items-center gap-2">
                    <p className="text-sm font-semibold text-primary flex items-center"><Sparkles className="w-4 h-4 mr-2 text-accent"/>Next Step: Turn Insights into Action</p>
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


function ReportSelectionTable({ reports, selectedIds, onSelectionChange }: { reports: StagedItem[], selectedIds: string[], onSelectionChange: (ids: string[]) => void }) {
    const isAllSelected = reports.length > 0 && selectedIds.length === reports.length;
    
    const handleSelectAll = (checked: boolean) => {
        onSelectionChange(checked ? reports.map(r => r.id) : []);
    };

    const handleRowSelect = (id: string, checked: boolean) => {
        if(checked) {
            onSelectionChange([...selectedIds, id]);
        } else {
            onSelectionChange(selectedIds.filter(i => i !== id));
        }
    };
    
    return (
        <ScrollArea className="h-72 border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox
                                checked={isAllSelected}
                                onCheckedChange={handleSelectAll}
                                aria-label="Select all rows"
                            />
                        </TableHead>
                        <TableHead>Report Name / Source</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reports.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No historical reports found for this product and source filter.
                            </TableCell>
                        </TableRow>
                    ) : (
                        reports.map(item => (
                            <TableRow key={item.id} data-state={selectedIds.includes(item.id) ? "selected" : undefined}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedIds.includes(item.id)}
                                        onCheckedChange={(checked) => handleRowSelect(item.id, !!checked)}
                                        aria-label={`Select report ${item.fileName}`}
                                    />
                                </TableCell>
                                <TableCell className="font-medium max-w-xs truncate" title={item.fileName}>
                                    {item.fileName}
                                </TableCell>
                                <TableCell>
                                     <Badge variant={item.type === 'Manual Score' ? 'outline' : 'secondary'}>
                                        {item.type === 'Manual Score' ? <Mic className="w-3 h-3 mr-1.5"/> : <Bot className="w-3 h-3 mr-1.5"/>}
                                        {item.type}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-mono">
                                        {item.scoreOutput?.overallScore?.toFixed(1) ?? 'N/A'} / 5.0
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {item.scoreOutput?.timestamp ? format(parseISO(item.scoreOutput.timestamp), "PP") : "Invalid Date"}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
    

    
