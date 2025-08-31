
"use client";

import { useState, useId } from 'react';
import { analyzeCallBatch, generateOptimizedPitches } from '@/ai/flows/combined-call-scoring-analysis';
import type { 
    CombinedCallAnalysisInput, CombinedCallAnalysisReportOutput, IndividualCallScoreDataItem, 
    ScoreCallOutput, Product, OptimizedPitchGenerationOutput, GeneratePitchOutput, KnowledgeFile, ProductObject
} from '@/types';
import { CombinedCallAnalysisResultsCard } from '@/components/features/combined-call-analysis/combined-call-analysis-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks, PieChart, Sparkles, Wand2 } from 'lucide-react';
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

const prepareKnowledgeBaseContext = (
  knowledgeBaseFiles: KnowledgeFile[] | undefined,
  productObject: ProductObject
): string => {
  if (!knowledgeBaseFiles || !Array.isArray(knowledgeBaseFiles)) {
    return "Knowledge Base not yet loaded or is empty.";
  }
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
  const [individualScores, setIndividualScores] = useState<IndividualCallScoreDataItem[]>([]);
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

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setFormError(null);
    setCombinedReport(null);
    setIndividualScores([]);
    setOptimizedPitches(null);
    setCurrentProcessMessage("Fetching historical call scores...");

    if (!selectedProduct) {
      setFormError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const historicalScores: IndividualCallScoreDataItem[] = (activities || [])
      .filter(activity =>
        (activity.module === "Call Scoring" || (activity.module === "AI Voice Sales Agent" && activity.details.finalScore)) &&
        activity.product === selectedProduct &&
        activity.details &&
        typeof activity.details === 'object'
      )
      .map(activity => {
        let scoreOutput;
        let fileName;
        if(activity.module === "Call Scoring") {
            scoreOutput = (activity.details as any).scoreOutput;
            fileName = (activity.details as any).fileName;
        } else {
            scoreOutput = (activity.details as any).finalScore;
            fileName = `Voice Call - ${(activity.details as any).input?.userName || 'User'}`;
        }
        
        if (scoreOutput && scoreOutput.callCategorisation !== "Error" && fileName) {
             return { fileName, scoreOutput };
        }
        return null;
      }).filter((item): item is IndividualCallScoreDataItem => item !== null);


    if (historicalScores.length < 2) {
      setFormError(`At least 2 successfully scored calls are required for a combined analysis of '${selectedProduct}'. Found ${historicalScores.length}. Please score more calls for this product first.`);
      setIsLoading(false);
      return;
    }

    setIndividualScores(historicalScores);
    setCurrentProcessMessage(`Found ${historicalScores.length} reports. Generating combined analysis...`);

    const combinedInput: CombinedCallAnalysisInput = {
      callReports: historicalScores,
      product: selectedProduct,
      overallAnalysisGoal: analysisGoal
    };

    try {
      const finalReport = await analyzeCallBatch(combinedInput);
      setCombinedReport(finalReport);
      setCurrentProcessMessage("Combined analysis complete!");
      if (finalReport.reportTitle.startsWith("Error:") || finalReport.reportTitle.startsWith("Critical Error:")) {
        setFormError(finalReport.batchExecutiveSummary);
        setCombinedReport(null);
        toast({ variant: "destructive", title: "Combined Analysis Error", description: "The AI returned an error. See details below.", duration: 7000 });
      } else {
        toast({ title: "Combined Analysis Complete!", description: "Aggregated report is ready." });
      }

      logActivity({
        module: "Combined Call Analysis",
        product: selectedProduct,
        details: { input: combinedInput, output: finalReport }
      });

    } catch (e: any) {
      const errorMessage = e.message || "Unknown error during combined analysis.";
      setFormError(`Combined analysis failed: ${errorMessage}`);
      setCurrentProcessMessage(`Error generating combined report: ${errorMessage.substring(0,100)}`);
      toast({ variant: "destructive", title: "Combined Analysis Failed", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateOptimizedPitches = async () => {
    if (!combinedReport || !selectedProduct) {
      toast({ variant: 'destructive', title: 'Error', description: 'A combined report must be generated first.' });
      return;
    }
    
    const productObject = getProductByName(selectedProduct);
    if (!productObject || !productObject.customerCohorts || productObject.customerCohorts.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No customer cohorts are defined for this product.' });
      return;
    }

    setIsGeneratingPitches(true);
    try {
      const kbContext = prepareKnowledgeBaseContext(knowledgeBaseFiles, productObject);
      const result = await generateOptimizedPitches({
        product: selectedProduct,
        cohortsToOptimize: productObject.customerCohorts,
        analysisReport: combinedReport,
        knowledgeBaseContext: kbContext,
      });

      setOptimizedPitches(result);
      setIsPitchDialogOpen(true);
      toast({ title: 'Pitches Generated!', description: `Optimized pitches for ${productObject.customerCohorts.length} cohorts are ready.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Pitch Generation Failed', description: e.message });
    } finally {
      setIsGeneratingPitches(false);
    }
  };
  
  return (
    <>
    <div className="flex flex-col h-full">
      <PageHeader title="Combined Call Scoring Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><PieChart className="mr-2 h-6 w-6 text-primary" /> Combined Call Analysis</CardTitle>
            <UiCardDescription>
                Run an aggregated analysis on all previously scored calls for a selected product to identify trends and actionable insights.
            </UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-select">Product Focus <span className="text-destructive">*</span></Label>
                <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v as string)}>
                  <SelectTrigger id="product-select">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.name} value={product.name}>
                        {product.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="analysis-goal">Specific Analysis Goal (Optional)</Label>
                  <Textarea 
                      id="analysis-goal"
                      placeholder="e.g., 'Focus on why pricing objections are leading to lost sales' or 'Assess consistency of new feature presentation'." 
                      rows={2} 
                      value={analysisGoal}
                      onChange={(e) => setAnalysisGoal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Provide a focus for the AI to get more specific, actionable insights.</p>
              </div>
              <Alert variant="default" className="mt-2">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>How It Works</AlertTitle>
                  <AlertDescription className="text-xs">
                    This tool automatically finds all historical call scoring reports for the selected product in your activity log. A minimum of 2 scored calls are required.
                  </AlertDescription>
              </Alert>
              <Button onClick={handleRunAnalysis} className="w-full" disabled={isLoading || !selectedProduct}>
                {isLoading ? currentProcessMessage : `Run Combined Analysis`}
              </Button>
          </CardContent>
          {combinedReport && !isLoading && (
            <CardFooter className="pt-4 border-t">
               <div className="w-full flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-primary">Turn Insights into Action!</p>
                 <Button onClick={handleGenerateOptimizedPitches} variant="default" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground" disabled={isGeneratingPitches}>
                    {isGeneratingPitches ? <LoadingSpinner size={16} className="mr-2"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                    {isGeneratingPitches ? 'Generating Optimized Pitches...' : 'Generate Optimized Pitches from This Analysis'}
                 </Button>
               </div>
            </CardFooter>
          )}
        </Card>

        {isLoading && !currentProcessMessage && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <LoadingSpinner size={32} />
            <p className="text-muted-foreground text-center">Preparing analysis...</p>
          </div>
        )}
        {formError && !isLoading && ( 
          <Alert variant="destructive" className="mt-4 max-w-lg">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline text-sm [&_svg]:ml-1">An error occurred. Click to view details.</AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <pre className="text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{formError}</pre>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Alert>
        )}
        {combinedReport && !isLoading && (
          <CombinedCallAnalysisResultsCard report={combinedReport} individualScores={individualScores} />
        )}
      </main>
    </div>
    {optimizedPitches && (
        <OptimizedPitchesDialog
            isOpen={isPitchDialogOpen}
            onClose={() => setIsPitchDialogOpen(false)}
            product={selectedProduct!}
            optimizedPitches={optimizedPitches.optimizedPitches}
        />
    )}
    </>
  );
}
