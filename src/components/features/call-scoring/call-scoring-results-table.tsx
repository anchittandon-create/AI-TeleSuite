
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Eye, Star, AlertTriangle, CheckCircle, PlayCircle, Download, FileAudio, ShieldCheck, ShieldAlert, FileText, ChevronDown } from 'lucide-react';
import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { CallScoringResultsCard } from './call-scoring-results-card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { downloadDataUriFile, exportPlainTextFile } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { CallScoreCategory } from '@/types';
import { exportCallScoreReportToPdf } from '@/lib/pdf-utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


export interface ScoredCallResultItem extends ScoreCallOutput {
  id: string;
  fileName: string;
  audioDataUri?: string;
  error?: string;
}

interface CallScoringResultsTableProps {
  results: ScoredCallResultItem[];
}

const mapAccuracyToPercentageString = (assessment: string): string => {
  if (!assessment) return "N/A";
  const lowerAssessment = assessment.toLowerCase();
  if (lowerAssessment.includes("high")) return "High (est. 95%+)";
  if (lowerAssessment.includes("medium")) return "Medium (est. 80-94%)";
  if (lowerAssessment.includes("low")) return "Low (est. <80%)";
  if (lowerAssessment.includes("error")) return "Error";
  return assessment; // Fallback for unknown values
};

export function CallScoringResultsTable({ results }: CallScoringResultsTableProps) {
  const [selectedResult, setSelectedResult] = useState<ScoredCallResultItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleViewDetails = (result: ScoredCallResultItem) => {
    setSelectedResult(result);
    setIsDialogOpen(true);
  };

  const handleDownloadAudio = (audioDataUri: string | undefined, fileName: string) => {
    if (!audioDataUri) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Audio data is not available for this file (it might have failed processing or an error occurred).",
      });
      return;
    }
    try {
      const downloadFilename = fileName || "audio_recording.unknown";
      downloadDataUriFile(audioDataUri, downloadFilename);
      toast({
        title: "Download Started",
        description: `Downloading ${downloadFilename}...`,
      });
    } catch (error) {
      console.error("Error downloading audio file:", error);
      toast({
        variant: "destructive",
        title: "Download Error",
        description: "Could not download the audio file.",
      });
    }
  };

  const formatReportForTextExport = (item: ScoredCallResultItem): string => {
    const { scoreOutput, fileName } = { scoreOutput: item, fileName: item.fileName };
    let output = `--- Call Scoring Report ---\n\n`;
    output += `File Name: ${fileName}\n`;
    output += `Overall Score: ${scoreOutput.overallScore.toFixed(1)}/5\n`;
    output += `Categorization: ${scoreOutput.callCategorisation}\n`;
    output += `Transcript Accuracy: ${scoreOutput.transcriptAccuracy}\n`;
    output += `\n--- Summary ---\n${scoreOutput.summary}\n`;
    output += `\n--- Strengths ---\n${scoreOutput.strengths.join('\n- ')}\n`;
    output += `\n--- Areas for Improvement ---\n${scoreOutput.areasForImprovement.join('\n- ')}\n`;
    output += `\n--- Detailed Metric Scores ---\n`;
    scoreOutput.metricScores.forEach(m => {
        output += `\nMetric: ${m.metric}\nScore: ${m.score}/5\nFeedback: ${m.feedback}\n`;
    });
    output += `\n--- Full Transcript ---\n${scoreOutput.transcript}\n`;
    return output;
  };

  const handleDownloadReport = (item: ScoredCallResultItem, format: 'pdf' | 'doc') => {
    const filenameBase = `Call_Report_${item.fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    if (format === 'pdf') {
      const itemForPdfExport = { // Create the object structure expected by the PDF exporter
        id: item.id,
        timestamp: new Date().toISOString(), // Use current time or a stored timestamp if available
        fileName: item.fileName,
        scoreOutput: item,
        // Add other required fields for HistoricalScoreItem if any, with defaults
        agentName: 'N/A', 
        product: 'N/A'
      };
      exportCallScoreReportToPdf(itemForPdfExport, `${filenameBase}.pdf`);
      toast({ title: "Report Exported", description: `PDF report for ${item.fileName} has been downloaded.` });
    } else {
      const textContent = formatReportForTextExport(item);
      exportPlainTextFile(`${filenameBase}.doc`, textContent);
      toast({ title: "Report Exported", description: `Text report for ${item.fileName} has been downloaded.` });
    }
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

  const getCategoryBadgeVariant = (category?: CallScoreCategory): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'very good':
        return 'default';
      case 'good':
        return 'secondary';
      case 'average':
        return 'outline';
      case 'bad':
      case 'very bad':
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getAccuracyIcon = (assessment?: string) => {
    if (!assessment) return <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline-block align-middle" />;
    const lowerAssessment = assessment.toLowerCase();
    if (lowerAssessment.includes("high")) return <ShieldCheck className="h-3.5 w-3.5 text-green-500 inline-block align-middle" />;
    if (lowerAssessment.includes("medium")) return <ShieldCheck className="h-3.5 w-3.5 text-yellow-500 inline-block align-middle" />;
    if (lowerAssessment.includes("low") || lowerAssessment.includes("error")) return <ShieldAlert className="h-3.5 w-3.5 text-red-500 inline-block align-middle" />;
    return <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline-block align-middle" />;
  };

  return (
    <>
      <div className="w-full max-w-5xl mt-8 shadow-lg rounded-lg border bg-card">
        <div className="p-6">
            <h2 className="text-xl font-semibold text-primary">Call Scoring Summary</h2>
            <p className="text-sm text-muted-foreground">Scoring results for {results.length} call(s).</p>
        </div>
        <ScrollArea className="h-[calc(100vh-450px)] md:h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-[50px]">SNo.</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead className="text-center w-[150px]">Overall Score</TableHead>
                <TableHead className="text-center w-[150px]">Categorization</TableHead>
                <TableHead className="text-center w-[200px]">Transcript Acc.</TableHead>
                <TableHead className="text-center w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No call scoring results to display.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((result, index) => (
                  <TableRow key={result.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate" title={result.fileName}>
                      <FileAudio className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                      {result.fileName}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" title={`${result.overallScore.toFixed(1)}/5`}>
                        {renderStars(result.overallScore, true)}
                      </div>
                      <span className="text-xs text-muted-foreground">({result.overallScore.toFixed(1)}/5)</span>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant={getCategoryBadgeVariant(result.callCategorisation)} className="text-xs">
                        {result.callCategorisation}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs" title={result.transcriptAccuracy}>
                       <div className="flex items-center justify-center gap-1">
                         {getAccuracyIcon(result.transcriptAccuracy)}
                         <span>{mapAccuracyToPercentageString(result.transcriptAccuracy || 'N/A')}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {result.error ? (
                          <Badge variant="destructive" className="cursor-default text-xs" title={result.error}>
                              <AlertTriangle className="mr-1 h-3 w-3" /> Error
                          </Badge>
                      ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" /> Scored
                          </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(result)}
                          title={"View Full Scoring Report / Play Audio"}
                      >
                        <Eye className="mr-1.5 h-4 w-4" /> Details
                      </Button>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                disabled={result.callCategorisation === "Error"}
                                title={result.callCategorisation === "Error" ? "Cannot download, error in generation" : "Download report options"}
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
                ))
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
                    File: {selectedResult.fileName}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto">
              <div className="p-6">
                {selectedResult.error ? (
                  <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Scoring Error for: {selectedResult.fileName}</AlertTitle>
                      <Accordion type="single" collapsible className="w-full text-xs">
                          <AccordionItem value="item-1" className="border-b-0">
                              <AccordionTrigger className="p-0 hover:no-underline [&[data-state=open]>svg]:text-destructive [&_svg]:ml-1">View error details</AccordionTrigger>
                              <AccordionContent className="pt-2">
                                  <pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono">{selectedResult.error}</pre>
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                      {selectedResult.audioDataUri && (
                        <div className="mt-3">
                          <h4 className="text-sm font-medium mb-1 flex items-center"><PlayCircle className="mr-1 h-4 w-4"/>Original Audio</h4>
                            <audio controls src={selectedResult.audioDataUri} className="w-full h-10">
                              Your browser does not support the audio element.
                            </audio>
                        </div>
                      )}
                  </Alert>
                ): (
                    <CallScoringResultsCard
                        results={selectedResult}
                        fileName={selectedResult.fileName}
                        audioDataUri={selectedResult.audioDataUri}
                    />
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
