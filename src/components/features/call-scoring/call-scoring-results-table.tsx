
"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Eye, Star, AlertTriangle, CheckCircle, ShieldCheck, ShieldAlert, Loader2, Clock, Download, ChevronDown, FileText } from 'lucide-react';
import { CallScoringResultsCard } from './call-scoring-results-card';
import { Product, HistoricalScoreItem, ScoreCallOutput } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { generateCallScoreReportPdfBlob } from '@/lib/pdf-utils';
import { exportPlainTextFile } from '@/lib/export';
import { format, parseISO } from 'date-fns';


interface CallScoringResultsTableProps {
  results: HistoricalScoreItem[];
}

export function CallScoringResultsTable({ results }: CallScoringResultsTableProps) {
  const [selectedResult, setSelectedResult] = useState<HistoricalScoreItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleViewDetails = (result: HistoricalScoreItem) => {
    setSelectedResult(result);
    setIsDialogOpen(true);
  };
  
  const renderStars = (score: number, small: boolean = false) => {
    const stars = [];
    const starClass = small ? "h-3.5 w-3.5" : "h-5 w-5";
    for (let i = 1; i <= 5; i++) {
      if (score >= i) {
        stars.push(<Star key={i} className={`${starClass} text-yellow-400 fill-yellow-400`} />);
      } else {
        stars.push(<Star key={i} className={`${starClass} text-muted-foreground/50`} />);
      }
    }
    return stars;
  };

  const getCategoryBadgeVariant = (category?: string): "default" | "secondary" | "destructive" | "outline" => {
    if(!category) return "secondary";
    switch (category.toLowerCase()) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'average': return 'outline';
      case 'needs improvement': return 'destructive';
      case 'poor': return 'destructive';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };
  
  const renderStatus = (item: HistoricalScoreItem) => {
    const status = item.details.status;
    switch(status) {
      case 'Queued':
        return <Badge variant="outline" className="text-xs"><Clock className="mr-1 h-3 w-3"/> Queued</Badge>;
      case 'Pending':
      case 'Transcribing':
      case 'Scoring':
        return <Badge variant="secondary" className="text-xs"><Loader2 className="mr-1 h-3 w-3 animate-spin"/> {status}...</Badge>;
      case 'Complete':
        return <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-300"><CheckCircle className="mr-1 h-3 w-3"/> Complete</Badge>;
      case 'Failed':
         return <Badge variant="destructive" className="cursor-pointer text-xs" title={item.details.error}><AlertTriangle className="mr-1 h-3 w-3"/> Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown ({status})</Badge>
    }
  }
  
  const formatReportForTextExport = (item: HistoricalScoreItem): string => {
    const { scoreOutput, fileName, agentNameFromForm: agentName, status, error } = item.details;
    const { product, timestamp } = item;
    
    if (!scoreOutput || status !== 'Complete') {
        return `--- Call Scoring Report for: ${fileName} ---\n\nStatus: ${status}\n${error ? `Error: ${error}\n` : ''}`;
    }

    const { overallScore, callCategorisation, summary, strengths, areasForImprovement, redFlags, metricScores, transcript } = scoreOutput;
    
    let output = `--- Call Scoring Report ---\n\n`;
    output += `File Name: ${fileName}\n`;
    output += `Agent Name: ${agentName || "N/A"}\n`;
    output += `Product Focus: ${product || "General"}\n`;
    output += `Date Scored: ${format(parseISO(timestamp), 'PP p')}\n`;
    
    output += `Overall Score: ${overallScore.toFixed(1)}/5\n`;
    output += `Categorization: ${callCategorisation}\n\n`;
    
    output += `--- SUMMARY & FEEDBACK ---\n`;
    output += `Summary: ${summary}\n\n`;
    output += `Strengths:\n- ${strengths.join('\n- ')}\n\n`;
    output += `Areas for Improvement:\n- ${areasForImprovement.join('\n- ')}\n\n`;
    if (redFlags && redFlags.length > 0) {
      output += `RED FLAGS:\n- ${redFlags.join('\n- ')}\n\n`;
    }
    
    output += `--- DETAILED METRICS ---\n`;
    metricScores.forEach(metric => {
      output += `Metric: ${metric.metric}\n`;
      output += `  Score: ${metric.score}/5\n`;
      output += `  Feedback: ${metric.feedback}\n\n`;
    });
    
    output += `--- FULL TRANSCRIPT ---\n${transcript}\n`;
    return output;
  };

  const handleDownloadReport = async (item: HistoricalScoreItem, format: 'pdf' | 'doc') => {
    try {
      if (!item.details.scoreOutput) {
        throw new Error("Report content is not available for this item.");
      }
      const filenameBase = `Call_Report_${item.details.fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      if (format === 'pdf') {
        const pdfBlob = await generateCallScoreReportPdfBlob(item);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `${filenameBase}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({ title: "Report Exported", description: `PDF report for ${item.details.fileName} has been downloaded.` });
      } else {
        const textContent = formatReportForTextExport(item);
        exportPlainTextFile(`${filenameBase}.doc`, textContent);
        toast({ title: "Report Exported", description: `Text report for ${item.details.fileName} has been downloaded.` });
      }
    } catch(error) {
      toast({ variant: "destructive", title: "Download Error", description: error instanceof Error ? error.message : "An unknown error occurred" });
      console.error("Download Error:", error);
    }
  };


  return (
    <>
      <div className="w-full max-w-5xl mt-8 shadow-lg rounded-lg border bg-card">
        <div className="p-6">
            <h2 className="text-xl font-semibold text-primary">Scoring Results</h2>
            <p className="text-sm text-muted-foreground">Results for {results.length} item(s).</p>
        </div>
        <ScrollArea className="h-[calc(100vh-450px)] md:h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[50px]">SNo.</TableHead>
                <TableHead>File Name / Source</TableHead>
                <TableHead className="text-center w-[150px]">Overall Score</TableHead>
                <TableHead className="text-center w-[150px]">Categorization</TableHead>
                <TableHead className="text-center w-[200px]">Status</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No call scoring jobs initiated yet.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((result, index) => {
                  const scoreOutput = result.details.scoreOutput;
                  const overallScore = scoreOutput?.overallScore ?? 0;
                  const category = scoreOutput?.callCategorisation;

                  return (
                    <TableRow key={result.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={result.details.fileName}>
                        {result.details.fileName}
                      </TableCell>
                      <TableCell className="text-center">
                        {scoreOutput ? (
                          <>
                            <div className="flex items-center justify-center gap-1" title={`${overallScore.toFixed(1)}/5`}>
                              {renderStars(overallScore, true)}
                            </div>
                            <span className="text-xs text-muted-foreground">({overallScore.toFixed(1)}/5)</span>
                          </>
                        ) : '...'}
                      </TableCell>
                      <TableCell className="text-center">
                         {category ? <Badge variant={getCategoryBadgeVariant(category)} className="text-xs">{category}</Badge> : '...'}
                      </TableCell>
                      <TableCell className="text-center text-xs" title={result.details.status}>
                        {renderStatus(result)}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(result)}
                            title={"View Full Scoring Report"}
                            disabled={!result.details.scoreOutput}
                        >
                          <Eye className="mr-1.5 h-4 w-4" /> Details
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                               <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-9 w-9"
                                  disabled={!scoreOutput}
                                  title={!scoreOutput ? "Report not available" : "Download report options"}
                                >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadReport(result, 'pdf')}>
                                <FileText className="mr-2 h-4 w-4"/> Download as PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadReport(result, 'doc')}>
                                <Download className="mr-2 h-4 w-4"/> Download as Text for Word
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {selectedResult && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl min-h-[70vh] max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-xl text-primary">Detailed Call Scoring Report</DialogTitle>
                <DialogDescription>
                    File: {selectedResult.details.fileName}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto">
              <div className="p-6">
                  {selectedResult.details.scoreOutput ? (
                    <CallScoringResultsCard
                        results={selectedResult.details.scoreOutput}
                        fileName={selectedResult.details.fileName}
                        agentName={selectedResult.details.agentNameFromForm}
                        product={selectedResult.product as Product}
                        audioDataUri={selectedResult.details.audioDataUri}
                        isHistoricalView={true}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8">
                       <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
                       <h3 className="text-lg font-semibold">Report Not Available</h3>
                       <p className="text-sm text-muted-foreground mt-2">The job status is '{selectedResult.details.status}'. A detailed report can only be viewed once the job is complete.</p>
                       {selectedResult.details.error && (
                            <div className="mt-4 text-left">
                                <p className="font-semibold">Error Details:</p>
                                <pre className="text-xs bg-destructive/10 text-destructive-foreground p-2 rounded-md whitespace-pre-wrap">
                                    {selectedResult.details.error}
                                </pre>
                            </div>
                        )}
                    </div>
                  )}
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
