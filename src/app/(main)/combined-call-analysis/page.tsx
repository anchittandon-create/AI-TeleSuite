
"use client";

import { useState, useId } from 'react';
import { analyzeCallBatch } from '@/ai/flows/combined-call-scoring-analysis';
import type { CombinedCallAnalysisInput, CombinedCallAnalysisReportOutput, IndividualCallScoreDataItem, ScoreCallOutput } from '@/types';
import { CombinedCallAnalysisResultsCard } from '@/components/features/combined-call-analysis/combined-call-analysis-results-card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, InfoIcon, ListChecks, PieChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from '@/components/ui/card';
import type { ActivityLogEntry, CombinedCallAnalysisActivityDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Product } from '@/types';
import { useProductContext } from '@/hooks/useProductContext';

export default function CombinedCallAnalysisPage() {
  const [combinedReport, setCombinedReport] = useState<CombinedCallAnalysisReportOutput | null>(null);
  const [individualScores, setIndividualScores] = useState<IndividualCallScoreDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProcessMessage, setCurrentProcessMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [analysisGoal, setAnalysisGoal] = useState('');

  const { toast } = useToast();
  const { logActivity, activities } = useActivityLogger();
  const { availableProducts } = useProductContext();

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setFormError(null);
    setCombinedReport(null);
    setIndividualScores([]);
    setCurrentProcessMessage("Fetching historical call scores...");

    if (!selectedProduct) {
      setFormError("Product selection is required.");
      setIsLoading(false);
      return;
    }

    const historicalScores: IndividualCallScoreDataItem[] = (activities || [])
      .filter(activity =>
        activity.module === "Call Scoring" &&
        activity.product === selectedProduct &&
        activity.details &&
        typeof activity.details === 'object' &&
        'scoreOutput' in activity.details &&
        'fileName' in activity.details
      )
      .map(activity => {
        const details = activity.details as { fileName: string, scoreOutput: ScoreCallOutput };
        return {
          fileName: details.fileName,
          scoreOutput: details.scoreOutput,
        };
      });

    if (historicalScores.length < 2) {
      setFormError(`At least 2 previously scored calls are required for a combined analysis of '${selectedProduct}'. Found ${historicalScores.length}. Please score more calls for this product first.`);
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

    const individualCallScoreDetailsForCombinedLog: CombinedCallAnalysisActivityDetails['individualCallScoreDetails'] = historicalScores.map(s => ({
        fileName: s.fileName,
        score: s.scoreOutput.overallScore,
        error: s.scoreOutput.callCategorisation === "Error" ? s.scoreOutput.summary : undefined
    }));

    try {
      const finalReport = await analyzeCallBatch(combinedInput);
      setCombinedReport(finalReport);
      setCurrentProcessMessage("Combined analysis complete!");
      if (finalReport.reportTitle.startsWith("Error:") || finalReport.reportTitle.startsWith("Critical Error:")) {
        toast({ variant: "destructive", title: "Combined Analysis Error", description: finalReport.batchExecutiveSummary, duration: 7000 });
      } else {
        toast({ title: "Combined Analysis Complete!", description: "Aggregated report is ready." });
      }

      logActivity({
        module: "Combined Call Analysis",
        product: selectedProduct,
        details: {
            input: combinedInput,
            output: finalReport,
            individualCallScoreDetails: individualCallScoreDetailsForCombinedLog
        } as CombinedCallAnalysisActivityDetails
      });

    } catch (e: any) {
      const errorMessage = e.message || "Unknown error during combined analysis.";
      setFormError(`Combined analysis failed: ${errorMessage}`);
      setCurrentProcessMessage(`Error generating combined report: ${errorMessage.substring(0,100)}`);
      toast({ variant: "destructive", title: "Combined Analysis Failed", description: errorMessage });
       logActivity({
        module: "Combined Call Analysis",
        product: selectedProduct,
        details: {
            input: combinedInput,
            error: errorMessage,
            individualCallScoreDetails: individualCallScoreDetailsForCombinedLog
        } as CombinedCallAnalysisActivityDetails
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Combined Call Scoring Analysis" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center space-y-6">
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><PieChart className="mr-2 h-6 w-6 text-primary" /> Combined Call Analysis</CardTitle>
            <UiCardDescription>
                Run an aggregated analysis on all previously scored calls for a selected product to identify trends and themes.
            </UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-select">Product Focus <span className="text-destructive">*</span></Label>
                <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v as Product)}>
                  <SelectTrigger id="product-select">
                    <SelectValue placeholder="Select product (ET / TOI)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.name} value={product.name}>
                        {product.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">The primary product these calls relate to.</p>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="analysis-goal">Specific Analysis Goal (Optional)</Label>
                  <Textarea 
                      id="analysis-goal"
                      placeholder="e.g., 'Focus on how pricing objections were handled in this batch' or 'Assess consistency of new product feature presentation'." 
                      rows={2} 
                      value={analysisGoal}
                      onChange={(e) => setAnalysisGoal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Provide a specific focus for the AI's combined analysis if desired.</p>
              </div>
              <Alert variant="default" className="mt-2">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>How It Works</AlertTitle>
                  <AlertDescription className="text-xs">
                    This tool will automatically find all historical call scoring reports for the selected product in your activity log. A minimum of 2 scored calls are required.
                  </AlertDescription>
              </Alert>
              <Button onClick={handleRunAnalysis} className="w-full" disabled={isLoading || !selectedProduct}>
                {isLoading ? currentProcessMessage : `Run Combined Analysis`}
              </Button>
          </CardContent>
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
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {combinedReport && !isLoading && (
          <CombinedCallAnalysisResultsCard report={combinedReport} individualScores={individualScores} />
        )}
         {!combinedReport && !isLoading && !formError && (
          <Card className="w-full max-w-lg shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-accent"/>
                    About Combined Call Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                    This feature allows you to analyze a batch of call recordings to get a high-level understanding of overall performance, common themes, and trends without re-uploading files.
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                    <li>Select the <strong>Product Focus</strong> for the calls.</li>
                    <li>Optionally, provide a <strong>Specific Analysis Goal</strong> to guide the AI's focus for the combined report.</li>
                    <li>Click <strong>Run Combined Analysis</strong>. The process involves:
                        <ul className="list-disc list-inside pl-5 text-xs">
                            <li>The system automatically finds all previously scored calls for that product from your activity log.</li>
                            <li>An AI then synthesizes these individual reports into a single combined analysis.</li>
                        </ul>
                    </li>
                </ol>
                <p className="mt-3 font-semibold text-foreground">
                    The combined report will provide an executive summary, average scores, common strengths and weaknesses, key themes, and metric performance summaries for the entire batch.
                </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
