
"use client";

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowUpDown, FileText, Download, Lightbulb, Settings, AlertCircle, BookOpen, MessageCircleQuestion } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { HistoricalAnalysisStrategyItem } from '@/types'; 
import type { DataAnalysisStrategyOutput, DataAnalysisInput } from '@/ai/flows/data-analyzer';
import { DataAnalysisResultsCard } from '@/components/features/data-analysis/data-analysis-results-card'; 
import { useToast } from '@/hooks/use-toast';
import { exportTextContentToPdf } from '@/lib/pdf-utils';
import { exportPlainTextFile } from '@/lib/export'; // Use exportPlainTextFile
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';


type SortKey = 'userAnalysisPromptShort' | 'timestamp' | 'analysisTitle' | 'fileCount' | null; 
type SortDirection = 'asc' | 'desc';


export function DataAnalysisDashboardTable({ history }: { history: HistoricalAnalysisStrategyItem[] }) { 
  const [selectedItem, setSelectedItem] = useState<HistoricalAnalysisStrategyItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (item: HistoricalAnalysisStrategyItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const formatStrategyForTextExport = (strategy: DataAnalysisStrategyOutput, input: DataAnalysisInput): string => {
    let output = `Data Analysis Strategy: ${strategy.analysisTitle || "Untitled Strategy"}\n\n`;
    output += `User Prompt:\n${input.userAnalysisPrompt}\n\n`;
    output += `File Context (${input.fileDetails.length} files):\n${input.fileDetails.map(f => `- ${f.fileName} (Type: ${f.fileType})`).join('\n')}\n\n`;
    if (input.sampledFileContent) output += `Sampled Text Content (from first CSV/TXT):\n${input.sampledFileContent}\n\n`;
    
    output += `--- Executive Summary ---\n${strategy.executiveSummary}\n\n`;
    if (strategy.directInsightsFromSampleText) {
        output += `--- Direct Insights From Sampled Data ---\n${strategy.directInsightsFromSampleText}\n\n`;
    }
    output += `--- Data Understanding & Preparation Guide ---\n${strategy.dataUnderstandingAndPreparationGuide}\n\n`;
    output += `--- Key Metrics & KPIs to Focus On ---\n${(strategy.keyMetricsAndKPIsToFocusOn || []).map(f => `- ${f}`).join('\n')}\n\n`;
    
    output += "--- Suggested Analytical Steps ---\n";
    (strategy.suggestedAnalyticalSteps || []).forEach(s => {
        output += `  Area: ${s.area}\n  Steps:\n${s.steps.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;
    });

    output += "--- Visualization Recommendations ---\n";
     (strategy.visualizationRecommendations || []).forEach(v => {
        output += `  Type: ${v.chartType}\n  Description: ${v.description}\n\n`;
    });
    
    output += `--- Potential Data Integrity Checks ---\n${(strategy.potentialDataIntegrityChecks || []).map(f => `- ${f}`).join('\n')}\n\n`;
    output += `--- Strategic Recommendations (Post-Analysis) ---\n${(strategy.strategicRecommendationsForUser || []).map(f => `- ${f}`).join('\n')}\n\n`;
    output += `--- Top Revenue Improvement Areas to Investigate ---\n${(strategy.topRevenueImprovementAreasToInvestigate || []).map(f => `- ${f}`).join('\n')}\n\n`;
    output += `--- Limitations & Disclaimer ---\n${strategy.limitationsAndDisclaimer}\n`;
    return output;
  };
  
  const handleDownloadStrategy = (item: HistoricalAnalysisStrategyItem, format: "pdf" | "doc") => {
    if (!item.details.analysisOutput || item.details.error) {
      toast({ variant: "destructive", title: "Download Error", description: "Strategy content is not available due to an error." });
      return;
    }
    const strategy = item.details.analysisOutput;
    const inputData = item.details.inputData;
    
    const filenameBase = `AnalysisStrategy_${(strategy.analysisTitle || "Untitled").replace(/[^a-z0-9]/gi, '_').slice(0,30)}_${format(parseISO(item.timestamp), 'yyyyMMddHHmmss')}`;
    const textContent = formatStrategyForTextExport(strategy, inputData);

    if (format === "pdf") {
      exportTextContentToPdf(textContent, `${filenameBase}.pdf`);
      toast({ title: "PDF Strategy Exported", description: `${filenameBase}.pdf has been downloaded.` });
    } else if (format === "doc") {
      exportPlainTextFile(`${filenameBase}.doc`, textContent);
      toast({ title: "Text for Word (.doc) Exported", description: `${filenameBase}.doc has been downloaded.` });
    }
  };
  
  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-1 h-3 w-3 inline transform rotate-180" /> : <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      let valA: any, valB: any;

      switch (sortKey) {
        case 'userAnalysisPromptShort':
          valA = a.details.inputData.userAnalysisPrompt.substring(0,50).toLowerCase();
          valB = b.details.inputData.userAnalysisPrompt.substring(0,50).toLowerCase();
          break;
        case 'analysisTitle':
          valA = a.details.analysisOutput?.analysisTitle?.toLowerCase() || (a.details.error ? 'error' : '');
          valB = b.details.analysisOutput?.analysisTitle?.toLowerCase() || (b.details.error ? 'error' : '');
          break;
        case 'timestamp':
          valA = new Date(a.timestamp).getTime();
          valB = new Date(b.timestamp).getTime();
          break;
        case 'fileCount':
          valA = a.details.inputData.fileDetails.length;
          valB = b.details.inputData.fileDetails.length;
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else {
        if (valA === undefined || valA === null) comparison = -1;
        else if (valB === undefined || valB === null) comparison = 1;
      }
      return sortDirection === 'desc' ? comparison * -1 : comparison;
    });
  }, [history, sortKey, sortDirection]);


  return (
    <>
      <div className="w-full mt-2 shadow-lg rounded-lg border bg-card">
        <ScrollArea className="h-[calc(100vh-280px)] md:h-[calc(100vh-250px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead onClick={() => requestSort('analysisTitle')} className="cursor-pointer">Strategy Title {getSortIndicator('analysisTitle')}</TableHead>
                <TableHead onClick={() => requestSort('userAnalysisPromptShort')} className="cursor-pointer">User Prompt (Start) {getSortIndicator('userAnalysisPromptShort')}</TableHead>
                <TableHead onClick={() => requestSort('fileCount')} className="cursor-pointer text-center">Files Context {getSortIndicator('fileCount')}</TableHead>
                <TableHead onClick={() => requestSort('timestamp')} className="cursor-pointer">Date Generated {getSortIndicator('timestamp')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No Analysis Strategies generated yet.
                  </TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[250px] truncate" title={item.details.analysisOutput?.analysisTitle}>
                      <Lightbulb className="inline-block mr-2 h-4 w-4 text-primary" />
                      {item.details.error ? <Badge variant="destructive">Error Generating Strategy</Badge> : item.details.analysisOutput?.analysisTitle || <span className="text-xs text-muted-foreground italic">Untitled Strategy</span>}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs" title={item.details.inputData.userAnalysisPrompt}>
                        {item.details.inputData.userAnalysisPrompt.substring(0, 70)}...
                    </TableCell>
                     <TableCell className="text-center">
                        <Badge variant="outline" title={item.details.inputData.fileDetails.map(f => f.fileName).join(', ')}>
                            {item.details.inputData.fileDetails.length} file(s)
                        </Badge>
                    </TableCell>
                    <TableCell>{format(parseISO(item.timestamp), 'PP p')}</TableCell>
                    <TableCell className="text-right space-x-1">
                       <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadStrategy(item, "pdf")}
                          disabled={!!item.details.error || !item.details.analysisOutput}
                          title={item.details.error ? "Cannot download, error in generation" : "Download Strategy as PDF"}
                          className="h-8 w-8"
                       >
                        <FileText className="h-4 w-4" />
                      </Button>
                       <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadStrategy(item, "doc")}
                          disabled={!!item.details.error || !item.details.analysisOutput}
                          title={item.details.error ? "Cannot download, error in generation" : "Download as Text for Word (.doc)"}
                          className="h-8 w-8"
                       >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item)}
                          title={"View Full Analysis Strategy"}
                      >
                        <Eye className="mr-1.5 h-4 w-4" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {selectedItem && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-5xl min-h-[80vh] max-h-[90vh] flex flex-col p-0"> 
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-xl text-primary">Data Analysis Strategy Playbook</DialogTitle>
                <DialogDesc>
                    Strategy: {selectedItem.details.analysisOutput?.analysisTitle || (selectedItem.details.error ? "Error" : "Untitled")} | Generated: {format(parseISO(selectedItem.timestamp), 'PP p')}
                </DialogDesc>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto">
              <div className="p-3 md:p-6"> 
                {selectedItem.details.error ? (
                     <div className="space-y-3 text-sm text-destructive bg-destructive/10 p-4 rounded-md">
                        <p className="font-semibold text-lg">Error During Strategy Generation:</p>
                        <Label htmlFor="error-input-prompt" className="font-medium">User Prompt:</Label>
                        <Textarea id="error-input-prompt" value={selectedItem.details.inputData.userAnalysisPrompt} readOnly className="min-h-[100px] bg-background/50" />
                        <Label className="font-medium">File Context:</Label>
                        <pre className="text-xs bg-background/50 p-2 rounded-md">{selectedItem.details.inputData.fileDetails.map(f=>`- ${f.fileName} (${f.fileType})`).join('\n') || "None"}</pre>
                        <p><strong>Error Message:</strong> {selectedItem.details.error}</p>
                    </div>
                ) : selectedItem.details.analysisOutput ? (
                  <DataAnalysisResultsCard 
                      strategyOutput={selectedItem.details.analysisOutput}
                      userAnalysisPrompt={selectedItem.details.inputData.userAnalysisPrompt}
                      fileContext={selectedItem.details.inputData.fileDetails}
                  />
                ) : (
                    <p className="text-muted-foreground">No analysis strategy output available for this entry.</p>
                )}
                 <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                      <AlertCircle className="inline h-4 w-4 mr-1.5 align-text-bottom"/>
                      Note: Original uploaded files (Excel, PDF, etc.) are not stored with the activity log and cannot be re-downloaded from this dashboard. The AI generates strategy based on your prompt, file names/types, and for CSV/TXT files, a small content sample.
                  </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/50">
              <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

