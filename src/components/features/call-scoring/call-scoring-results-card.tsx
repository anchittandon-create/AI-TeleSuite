
"use client";

import type { ScoreCallOutput } from "@/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TranscriptDisplay } from "../transcription/transcript-display";
import { useToast } from "@/hooks/use-toast";
import { downloadDataUriFile, exportPlainTextFile } from "@/lib/export";
import { exportCallScoreReportToPdf } from "@/lib/pdf-utils";
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import { Product } from "@/types";

import {
  ThumbsUp, ThumbsDown, Star, AlertCircle, PlayCircle, Download, FileText,
  ChevronDown, TrendingUp, ShieldAlert, CheckSquare, MessageSquare, Goal,
  Voicemail, UserCheck, Languages, Radio, Gauge, Clock, MessageCircleQuestion,
  Users, Handshake, Target, Check, Trophy
} from "lucide-react";

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
  agentName?: string;
  product?: Product;
  audioDataUri?: string;
  isHistoricalView?: boolean;
}

const getCategoryFromScore = (score: number): string => {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Average";
  if (score >= 1.5) return "Needs Improvement";
  return "Poor";
};

const getCategoryBadgeVariant = (category?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'average': return 'outline';
      case 'needs improvement': return 'destructive';
      case 'poor': return 'destructive';
      default: return 'secondary';
    }
};

const renderStars = (score: number) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(<Star key={i} className={`h-4 w-4 ${score >= i ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50"}`} />);
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
};

const formatReportForTextExport = (results: ScoreCallOutput, fileName?: string, agentName?: string, product?: string): string => {
  let output = `--- Call Scoring Report: ${fileName || 'N/A'} ---\n\n`;
  output += `Overall Score: ${results.overallScore?.toFixed(1) || 'N/A'}/5\n`;
  output += `Categorization: ${results.callCategorisation || 'N/A'}\n\n`;
  
  output += `--- SUMMARY & FEEDBACK ---\n`;
  output += `Summary: ${results.summary}\n\n`;
  output += `Strengths:\n- ${results.strengths.join('\n- ')}\n\n`;
  output += `Areas for Improvement:\n- ${results.areasForImprovement.join('\n- ')}\n\n`;
  
  output += `--- DETAILED METRICS ---\n`;
  (results.metricScores || []).forEach(metric => {
    output += `Metric: ${metric.metric}\n`;
    output += `  Score: ${metric.score}/5\n`;
    output += `  Feedback: ${metric.feedback}\n\n`;
  });
  
  output += `--- FULL TRANSCRIPT ---\n${results.transcript}\n`;
  return output;
};


export function CallScoringResultsCard({ results, fileName, agentName, product, audioDataUri, isHistoricalView = false }: CallScoringResultsCardProps) {
  const { toast } = useToast();
  
   const handleDownloadReport = (format: 'pdf' | 'doc') => {
      if (!results.overallScore) {
        toast({variant: 'destructive', title: 'Cannot Download', description: 'Report data is incomplete due to a scoring error.'});
        return;
      }
      const itemForPdfExport: HistoricalScoreItem = {
          id: `export-${Date.now()}`,
          timestamp: new Date().toISOString(),
          details: {
            fileName: fileName || "Scored Call",
            agentNameFromForm: agentName,
            status: 'Complete',
            scoreOutput: results,
          },
          product: product,
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
  
  const renderMetric = (metricName: string, metric: {score: number, feedback: string}) => (
      <div key={metricName} className="py-2 px-3 border-b last:border-b-0">
          <div className="flex justify-between items-center">
              <h4 className="font-medium text-sm text-foreground">{metricName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
              <div className="flex items-center gap-2">
                  {renderStars(metric.score)}
                  <Badge variant={getCategoryBadgeVariant(getCategoryFromScore(metric.score))} className="text-xs w-28 text-center justify-center">
                      {getCategoryFromScore(metric.score)}
                  </Badge>
              </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 pl-1">{metric.feedback}</p>
      </div>
  );

  const METRIC_CATEGORIES = {
    'Structure & Flow': ['Call Opening', 'Greeting & Introduction', 'Call Structuring', 'Segue Smoothness', 'Time Management'],
    'Communication & Delivery': ['Voice Tone', 'Energy Level', 'Pitch & Modulation', 'Clarity of Speech', 'Filler Usage', 'Hindi-English Switching'],
    'Discovery & Need Mapping': ['Persona Identification', 'Probing Depth', 'Active Listening', 'Relevance Alignment'],
    'Sales Pitch Quality': ['Value Proposition', 'Feature-to-Need Fit', 'Use of Quantifiable Value', 'Emotional Triggers', 'Time Saving Emphasis', 'Content Differentiation'],
    'Objection Handling': ['Price Objection', 'Relevance Objection', 'Content Overlap Objection', 'Indecision Handling', 'Pushback Pivoting'],
    'Plan Explanation & Closing': ['Plan Breakdown Clarity', 'Bundle Leveraging', 'Scarcity/Urgency Use', 'Assumptive Closing', 'Call-to-Action Strength'],
    'Ending & Follow-up': ['Summarization', 'Next Step Clarity', 'Closing Tone'],
    'Conversion Indicators': ['User Response Pattern', 'Hesitation Patterns', 'Momentum Building', 'Conversion Readiness'],
  };
  const METRIC_ICONS: { [key: string]: React.ElementType } = {
    'Structure & Flow': Voicemail,
    'Communication & Delivery': Radio,
    'Discovery & Need Mapping': UserCheck,
    'Sales Pitch Quality': Handshake,
    'Objection Handling': MessageSquareQuestion,
    'Plan Explanation & Closing': Target,
    'Ending & Follow-up': Check,
    'Conversion Indicators': TrendingUp
  };


  if (!results.overallScore) {
      return (
          <Alert variant="destructive" className="w-full max-w-4xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Scoring Error for: {fileName}</AlertTitle>
              <Accordion type="single" collapsible className="w-full text-xs">
                  <AccordionItem value="item-1" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline [&[data-state=open]>svg]:text-destructive-foreground [&_svg]:ml-1">View error details</AccordionTrigger>
                      <AccordionContent className="pt-2">
                          <pre className="whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded-md font-mono text-xs">{results.summary || "No specific error message available."}</pre>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>
          </Alert>
      );
  }

  return (
      <div className="w-full">
          <div className="flex justify-end mb-4">
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Download Full Report</Button>
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
           {audioDataUri && !isHistoricalView && (
              <div className="mb-4">
                  <h3 className="text-md font-semibold text-foreground mb-2 flex items-center"><PlayCircle className="mr-2 h-5 w-5 text-primary"/>Audio Playback</h3>
                  <audio controls src={audioDataUri} className="w-full h-10">
                      Your browser does not support the audio element.
                  </audio>
              </div>
          )}
          
          <Accordion type="multiple" defaultValue={["finalSummary", "Structure & Flow", "transcript"]} className="w-full space-y-2">
            
             <AccordionItem value="finalSummary">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline bg-muted/30 px-4 py-3 rounded-md">Final Summary & Coaching</AccordionTrigger>
                <AccordionContent className="pt-3 px-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-md flex items-center gap-2"><ThumbsUp className="text-green-500"/>Key Strengths</CardTitle></CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            {results.strengths.map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
                          </ul>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-md flex items-center gap-2"><ThumbsDown className="text-amber-500"/>Areas for Improvement</CardTitle></CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                             {results.areasForImprovement.map((g, i) => <li key={`gap-${i}`}>{g}</li>)}
                          </ul>
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>

            {Object.entries(METRIC_CATEGORIES).map(([category, metrics]) => {
              const Icon = METRIC_ICONS[category] || Trophy;
              const relevantMetrics = (results.metricScores || []).filter(m => metrics.some(catMetric => m.metric.toLowerCase().includes(catMetric.toLowerCase())));
              
              if (relevantMetrics.length === 0) return null;

              return (
                <AccordionItem value={category} key={category}>
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline bg-muted/30 px-4 py-3 rounded-md">
                    <div className="flex items-center gap-2"><Icon className="h-5 w-5"/>{category}</div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 px-1">
                    <Card><CardContent className="p-0 divide-y">
                      {relevantMetrics.map((metric) => renderMetric(metric.metric, metric))}
                    </CardContent></Card>
                  </AccordionContent>
                </AccordionItem>
              );
            })}

             <AccordionItem value="transcript">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline bg-muted/30 px-4 py-3 rounded-md">Full Transcript</AccordionTrigger>
                <AccordionContent className="pt-3 px-1">
                    <Card><CardContent className="p-3">
                        <ScrollArea className="h-[400px] w-full">
                            <TranscriptDisplay transcript={results.transcript} />
                        </ScrollArea>
                    </CardContent></Card>
                </AccordionContent>
            </AccordionItem>

          </Accordion>
      </div>
  );
}
