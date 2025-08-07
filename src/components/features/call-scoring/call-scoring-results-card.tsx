
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Star, AlertCircle, ListChecks, CheckSquare, MessageSquare, PlayCircle, FileAudio, Download, FileText, ChevronDown, Newspaper, TrendingUp, ShieldAlert as RedFlagIcon, Ratio, Timer, MicOff } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallScoreCategory, Product } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { downloadDataUriFile, exportPlainTextFile } from "@/lib/export";
import { exportCallScoreReportToPdf } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptDisplay } from "../transcription/transcript-display";


interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
  agentName?: string;
  product?: Product;
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

const formatReportForTextExport = (results: ScoreCallOutput, fileName?: string, agentName?: string, product?: string): string => {
    let output = `--- Call Scoring Report ---\n\n`;
    output += `File Name: ${fileName || 'N/A'}\n`;
    output += `Agent Name: ${agentName || 'N/A'}\n`;
    output += `Product Focus: ${product || 'General'}\n`;
    output += `Overall Score: ${results.overallScore.toFixed(1)}/5\n`;
    output += `Categorization: ${results.callCategorisation}\n`;
    output += `Transcript Accuracy: ${results.transcriptAccuracy}\n`;
    
    if (results.quantitativeAnalysis) {
        output += `\n--- Quantitative Analysis ---\n`;
        output += `Talk-to-Listen Ratio: ${results.quantitativeAnalysis.talkToListenRatio || 'N/A'}\n`;
        output += `Longest Agent Monologue: ${results.quantitativeAnalysis.longestMonologue || 'N/A'}\n`;
        output += `Silence/Dead Air Analysis: ${results.quantitativeAnalysis.silenceAnalysis || 'N/A'}\n`;
    }

    output += `\n--- Summary ---\n${results.summary}\n`;
    output += `\n--- Strengths ---\n- ${results.strengths.join('\n- ')}\n`;
    output += `\n--- Areas for Improvement ---\n- ${results.areasForImprovement.join('\n- ')}\n`;
    if (results.redFlags && results.redFlags.length > 0) {
        output += `\n--- Red Flags / Critical Flaws ---\n- ${results.redFlags.join('\n- ')}\n`;
    }
    output += `\n--- Detailed Metric Scores ---\n`;
    results.metricScores.forEach(m => {
        output += `\nMetric: ${m.metric}\nScore: ${m.score}/5 (${getPerformanceStringFromScore(m.score)})\nFeedback: ${m.feedback}\n`;
    });
    output += `\n--- Full Transcript ---\n${results.transcript}\n`;
    return output;
  };

export function CallScoringResultsCard({ results, fileName, agentName, product, audioDataUri, isHistoricalView = false }: CallScoringResultsCardProps) {
    const { toast } = useToast();

    const handleDownloadReport = (format: 'pdf' | 'doc') => {
        // Create a temporary item that matches the HistoricalScoreItem structure for the PDF utility
        const itemForPdfExport: HistoricalScoreItem = {
            id: `export-${Date.now()}`,
            timestamp: new Date().toISOString(),
            fileName: fileName || "Scored Call",
            agentName: agentName,
            product: product,
            scoreOutput: results,
        };

        if (format === 'pdf') {
            exportCallScoreReportToPdf(itemForPdfExport, `Call_Report_${(fileName || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            toast({ title: "Report Exported", description: `PDF report has been downloaded.` });
        } else {
            const textContent = formatReportForTextExport(results, fileName, agentName, product);
            exportPlainTextFile(`Call_Report_${(fileName || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.doc`, textContent);
            toast({ title: "Report Exported", description: `Text report for Word has been downloaded.` });
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
        <Alert variant="destructive" className="w-full max-w-4xl">
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
    <div className="w-full">
      <Tabs defaultValue="overall" className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-y-2">
            <div>
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
            </div>
             <div className="flex items-center gap-2">
                <TabsList className="grid w-full grid-cols-6 h-9">
                    <TabsTrigger value="overall" className="text-xs px-2"><ListChecks className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Summary</span></TabsTrigger>
                    <TabsTrigger value="transcript" className="text-xs px-2"><Newspaper className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Transcript</span></TabsTrigger>
                    <TabsTrigger value="detailed-metrics" className="text-xs px-2"><Star className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Metrics</span></TabsTrigger>
                    <TabsTrigger value="strengths" className="text-xs px-2"><ThumbsUp className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Strengths</span></TabsTrigger>
                    <TabsTrigger value="improvements" className="text-xs px-2"><TrendingUp className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Improvements</span></TabsTrigger>
                    <TabsTrigger value="redflags" className="text-xs px-2"><RedFlagIcon className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Red Flags</span></TabsTrigger>
                </TabsList>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Download</Button>
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
        </div>
        
        <TabsContent value="overall" className="mt-0 space-y-4">
             {audioDataUri && !isHistoricalView && (
                <div>
                    <h3 className="text-md font-semibold text-foreground mb-2 flex items-center"><PlayCircle className="mr-2 h-5 w-5 text-primary"/>Audio Playback</h3>
                     <audio controls src={audioDataUri} className="w-full h-10">
                        Your browser does not support the audio element.
                     </audio>
                </div>
            )}
            <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border leading-relaxed">
                    {results.summary || "No summary provided."}
                </p>
            </div>
            {results.quantitativeAnalysis && (
                <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Quantitative Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                        <Card className="p-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1"><Ratio size={14}/>Talk/Listen Ratio</CardTitle>
                            <CardDescription className="text-2xl font-bold text-primary">{results.quantitativeAnalysis.talkToListenRatio || 'N/A'}</CardDescription>
                        </Card>
                        <Card className="p-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1"><Timer size={14}/>Longest Monologue</CardTitle>
                            <CardDescription className="text-lg font-semibold text-primary">{results.quantitativeAnalysis.longestMonologue || 'N/A'}</CardDescription>
                        </Card>
                         <Card className="p-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1"><MicOff size={14}/>Silence Analysis</CardTitle>
                            <CardDescription className="text-sm text-primary">{results.quantitativeAnalysis.silenceAnalysis || 'N/A'}</CardDescription>
                        </Card>
                    </div>
                </div>
            )}
        </TabsContent>

        <TabsContent value="transcript" className="mt-0">
             <ScrollArea className="h-[400px] w-full rounded-md border p-3 bg-background">
                <TranscriptDisplay transcript={results.transcript} />
             </ScrollArea>
        </TabsContent>

        <TabsContent value="detailed-metrics" className="mt-0">
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
        </TabsContent>

        <TabsContent value="strengths" className="mt-0">
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
        </TabsContent>

         <TabsContent value="improvements" className="mt-0">
             <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-amber-500"/>Areas for Improvement</h3>
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
        </TabsContent>
        
         <TabsContent value="redflags" className="mt-0">
             <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><RedFlagIcon className="mr-2 h-5 w-5 text-destructive"/>Red Flags / Critical Flaws</h3>
            {results.redFlags && results.redFlags.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted-foreground pl-1">
                {results.redFlags.map((item, index) => (
                <li key={`redflag-${index}`} className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-destructive mr-2 mt-0.5 shrink-0"/>
                    <span>{item}</span>
                </li>
                ))}
            </ul>
            ) : (
            <p className="text-sm text-muted-foreground italic">No critical flaws were flagged by the AI for this call.</p>
            )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
