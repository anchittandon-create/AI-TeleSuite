
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Star, AlertCircle, ListChecks, CheckSquare, MessageSquare, PlayCircle, FileAudio, Download, FileText, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallScoreCategory } from "@/types";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { downloadDataUriFile, exportPlainTextFile } from "@/lib/export";
import { generateCallScoreReportPdfBlob, exportCallScoreReportToPdf } from '@/lib/pdf-utils';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
  audioDataUri?: string;
  isHistoricalView?: boolean;
}

const getCategoryBadgeVariant = (category?: CallScoreCategory | string): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'very good':
      case 'excellent':
        return 'default';
      case 'good':
        return 'secondary';
      case 'average':
      case 'fair':
        return 'outline';
      case 'bad':
      case 'very bad':
      case 'poor':
      case 'needs improvement':
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
};

const getPerformanceStringFromScore = (score: number): string => {
  if (score <= 1.5) return "Poor";
  if (score <= 2.5) return "Needs Improvement";
  if (score <= 3.5) return "Average";
  if (score <= 4.5) return "Good";
  return "Excellent";
};

const formatReportForTextExport = (results: ScoreCallOutput, fileName?: string): string => {
    let output = `--- Call Scoring Report ---\n\n`;
    output += `File Name: ${fileName || 'N/A'}\n`;
    output += `Overall Score: ${results.overallScore.toFixed(1)}/5\n`;
    output += `Categorization: ${results.callCategorisation}\n`;
    output += `Transcript Accuracy: ${results.transcriptAccuracy}\n`;
    output += `\n--- Summary ---\n${results.summary}\n`;
    output += `\n--- Strengths ---\n- ${results.strengths.join('\n- ')}\n`;
    output += `\n--- Areas for Improvement ---\n- ${results.areasForImprovement.join('\n- ')}\n`;
    output += `\n--- Detailed Metric Scores ---\n`;
    results.metricScores.forEach(m => {
        output += `\nMetric: ${m.metric}\nScore: ${m.score}/5\nFeedback: ${m.feedback}\n`;
    });
    output += `\n--- Full Transcript ---\n${results.transcript}\n`;
    return output;
  };

export function CallScoringResultsCard({ results, fileName, audioDataUri, isHistoricalView = false }: CallScoringResultsCardProps) {
    const { toast } = useToast();

    const handleDownloadReport = (format: 'pdf' | 'doc') => {
        const filenameBase = `Call_Report_${(fileName || 'report').replace(/[^a-zA-Z0-9]/g, '_')}`;

        if (format === 'pdf') {
            const itemForPdfExport: HistoricalScoreItem = {
                id: `export-${Date.now()}`,
                timestamp: new Date().toISOString(),
                fileName: fileName || "Scored Call",
                scoreOutput: results,
            };
            exportCallScoreReportToPdf(itemForPdfExport, `${filenameBase}.pdf`);
            toast({ title: "Report Exported", description: `PDF report has been downloaded.` });
        } else {
            const textContent = formatReportForTextExport(results, fileName);
            exportPlainTextFile(`${filenameBase}.doc`, textContent);
            toast({ title: "Report Exported", description: `Text report has been downloaded.` });
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
    
    if (results.callCategorisation === "Error") {
      return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Scoring Error for: {fileName}</AlertTitle>
             <Accordion type="single" collapsible className="w-full text-xs">
              <AccordionItem value="item-1" className="border-b-0">
                  <AccordionTrigger className="p-0 hover:no-underline [&[data-state=open]>svg]:text-destructive-foreground [&_svg]:ml-1">View error details</AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono text-xs">{results.summary || results.transcript || "No specific error message available."}</pre>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
            {audioDataUri && (
                <div className="mt-3">
                    <h4 className="text-sm font-medium mb-1 flex items-center"><PlayCircle className="mr-1 h-4 w-4"/>Original Audio</h4>
                    <audio controls src={audioDataUri} className="w-full h-10">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
        </Alert>
      )
    }


  return (
    <Card className="w-full max-w-4xl shadow-none mt-0 border-0 bg-transparent">
        <CardHeader className="p-0 mb-4">
             <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-primary">{results.overallScore.toFixed(1)}/5</div>
                        <div className="flex items-center justify-center gap-0.5">{renderStars(results.overallScore)}</div>
                    </div>
                    <div>
                        <Badge variant={getCategoryBadgeVariant(results.callCategorisation)} className="text-sm">
                            {results.callCategorisation}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Transcript Accuracy: {results.transcriptAccuracy}</p>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Download Report</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleDownloadReport('pdf')}>
                           <FileText className="mr-2 h-4 w-4"/> Download as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadReport('doc')}>
                           <FileText className="mr-2 h-4 w-4"/> Download as Text for Word
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardHeader>
        
        <div className="space-y-6">
            {audioDataUri && !isHistoricalView && (
                <div>
                    <h3 className="text-md font-semibold text-foreground mb-2 flex items-center"><PlayCircle className="mr-2 h-5 w-5 text-primary"/>Audio Playback</h3>
                     <audio controls src={audioDataUri} className="w-full h-10">
                        Your browser does not support the audio element.
                     </audio>
                </div>
            )}
            <div>
                <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Summary</h3>
                <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border leading-relaxed">
                    {results.summary || "No summary provided."}
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><ThumbsUp className="mr-2 h-5 w-5 text-green-500"/>Key Strengths</h3>
                    {results.strengths && results.strengths.length > 0 ? (
                    <ul className="space-y-2 text-sm text-muted-foreground pl-1">
                        {results.strengths.map((item, index) => (
                        <li key={`strength-${index}`} className="flex items-start">
                            <CheckSquare className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0"/>
                            <span>{item}</span>
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-sm text-muted-foreground italic">No specific strengths highlighted.</p>
                    )}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><ThumbsDown className="mr-2 h-5 w-5 text-amber-500"/>Areas for Improvement</h3>
                    {results.areasForImprovement && results.areasForImprovement.length > 0 ? (
                    <ul className="space-y-2 text-sm text-muted-foreground pl-1">
                        {results.areasForImprovement.map((item, index) => (
                        <li key={`improvement-${index}`} className="flex items-start">
                            <MessageSquare className="h-4 w-4 text-amber-500 mr-2 mt-0.5 shrink-0"/>
                            <span>{item}</span>
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-sm text-muted-foreground italic">No specific improvement areas highlighted.</p>
                    )}
                </div>
            </div>

            {(results.metricScores && results.metricScores.length > 0) ? (
            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader className="bg-primary/10">
                    <TableRow>
                        <TableHead className="w-[30%] font-semibold text-primary/90">Metric</TableHead>
                        <TableHead className="w-[15%] text-center font-semibold text-primary/90">Score</TableHead>
                        <TableHead className="font-semibold text-primary/90">Feedback & Observations</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {results.metricScores.map((metricItem, index) => (
                        <TableRow key={`detailed-metric-${index}`} className="text-sm">
                        <TableCell className="font-medium py-3">{metricItem.metric}</TableCell>
                        <TableCell className="text-center py-3">
                            <Badge variant={getCategoryBadgeVariant(getPerformanceStringFromScore(metricItem.score))} className="text-xs">
                                {metricItem.score}/5
                            </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3 whitespace-pre-line">{metricItem.feedback}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
            ) : (
            <p className="text-muted-foreground text-sm p-3 italic">No detailed metric scores available.</p>
            )}
        </div>
    </Card>
  );
}
