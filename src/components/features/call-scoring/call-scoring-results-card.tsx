
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Star,ThumbsUp, ThumbsDown, Target, Info, FileText, StarHalf, ShieldCheck, ShieldAlert, Mic, PlayCircle, AlertCircle } from "lucide-react"; // Added AlertCircle
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CallScoreCategory } from "@/types";

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
  audioDataUri?: string;
  isHistoricalView?: boolean; // New prop
}

export function CallScoringResultsCard({ results, fileName, audioDataUri, isHistoricalView = false }: CallScoringResultsCardProps) {
  const renderStars = (score: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (score >= i) {
        stars.push(<Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />);
      } else if (score >= i - 0.5) {
        stars.push(<StarHalf key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="h-5 w-5 text-muted-foreground/50" />);
      }
    }
    return stars;
  };

  const getCategoryBadgeVariant = (category?: CallScoreCategory | string): "default" | "secondary" | "destructive" | "outline" => {
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
    if (!assessment) return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
    const lowerAssessment = assessment.toLowerCase();
    if (lowerAssessment.includes("high")) return <ShieldCheck className="h-4 w-4 text-green-500" />;
    if (lowerAssessment.includes("medium")) return <ShieldCheck className="h-4 w-4 text-yellow-500" />;
    if (lowerAssessment.includes("low") || lowerAssessment.includes("error")) return <ShieldAlert className="h-4 w-4 text-red-500" />;
    return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
  };


  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8">
      <CardHeader>
        <div className="flex justify-between items-start flex-wrap gap-y-2">
          <div>
            <CardTitle className="text-2xl text-primary flex items-center">
              <Mic className="mr-3 h-7 w-7" /> Call Scoring Report
            </CardTitle>
            {fileName && <CardDescription>Analysis for: {fileName}</CardDescription>}
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-2">
              {renderStars(results.overallScore)}
              <span className="text-xl font-bold text-foreground ml-1">{results.overallScore.toFixed(1)} / 5</span>
            </div>
            {results.callCategorisation && (
              <Badge variant={getCategoryBadgeVariant(results.callCategorisation)} className="text-sm">
                {results.callCategorisation}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isHistoricalView && !audioDataUri ? (
          <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <Label className="flex items-center mb-1 font-medium text-sm text-amber-700">
              <AlertCircle className="mr-2 h-5 w-5" /> Note on Historical Audio
            </Label>
            <p className="text-xs text-amber-600">
              Original audio file is not available for playback or download in historical dashboard views. This data is not stored with the activity log to conserve browser storage. Audio can be accessed on the main 'Call Scoring' page for items processed during the current session.
            </p>
          </div>
        ) : audioDataUri ? (
          <>
            <div className="mb-2">
              <Label htmlFor={`audio-player-scoring-${fileName?.replace(/[^a-zA-Z0-9]/g, "") || 'default'}`} className="flex items-center mb-1 font-semibold text-md">
                  <PlayCircle className="mr-2 h-5 w-5 text-primary" /> Original Audio
              </Label>
              <audio id={`audio-player-scoring-${fileName?.replace(/[^a-zA-Z0-9]/g, "") || 'default'}`} controls src={audioDataUri} className="w-full h-10">
                Your browser does not support the audio element.
              </audio>
            </div>
            <Separator />
          </>
        ) : null}

        <Accordion type="single" collapsible className="w-full space-y-2" defaultValue="item-summary">
          <AccordionItem value="item-summary">
             <AccordionTrigger className="text-lg font-semibold hover:no-underline py-3">
                <div className="flex items-center"><Info className="mr-2 h-5 w-5 text-accent"/>Overall Summary</div>
            </AccordionTrigger>
            <AccordionContent>
                 <p className="text-muted-foreground pt-1">{results.summary || "No summary provided."}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-transcript">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline py-3">
                <div className="flex items-center"><FileText className="mr-2 h-5 w-5 text-accent"/>Call Transcript</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2" title={`Transcript Accuracy: ${results.transcriptAccuracy}`}>
                  {getAccuracyIcon(results.transcriptAccuracy)}
                  <span>{results.transcriptAccuracy || "N/A"}</span>
              </div>
              <ScrollArea className="h-60 w-full rounded-md border p-3 bg-muted/20">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {results.transcript || "Transcript not available."}
                </p>
              </ScrollArea>
              {results.transcriptAccuracy && results.transcriptAccuracy.toLowerCase().includes("low") && (
                <p className="text-xs text-destructive mt-1">Note: Transcript accuracy is low. Scoring may be impacted.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center"><ThumbsUp className="mr-2 h-5 w-5 text-green-500"/>Strengths</h3>
            {results.strengths && results.strengths.length > 0 ? (
              <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
                {results.strengths.map((item, index) => (
                  <li key={`strength-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No specific strengths highlighted.</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center"><ThumbsDown className="mr-2 h-5 w-5 text-red-500"/>Areas for Improvement</h3>
            {results.areasForImprovement && results.areasForImprovement.length > 0 ? (
              <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
                {results.areasForImprovement.map((item, index) => (
                  <li key={`improvement-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No specific areas for improvement highlighted.</p>
            )}
          </div>
        </div>

        <Separator className="my-4"/>

        <Accordion type="single" collapsible className="w-full"  defaultValue="item-metrics">
            <AccordionItem value="item-metrics">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline py-3">
                    <div className="flex items-center"><Target className="mr-2 h-5 w-5 text-accent"/>Metric-wise Breakdown</div>
                </AccordionTrigger>
                <AccordionContent>
                    {results.metricScores && results.metricScores.length > 0 ? (
                    <ScrollArea className="max-h-[400px] overflow-y-auto pt-2">
                        <Table className="border rounded-md">
                        <TableHeader className="bg-muted/50 sticky top-0">
                            <TableRow>
                            <TableHead className="w-[25%]">Metric</TableHead>
                            <TableHead className="w-[20%] text-center">Score</TableHead>
                            <TableHead>Feedback & Observations</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.metricScores.map((metricItem, index) => (
                            <TableRow key={`metric-${index}`}>
                                <TableCell className="font-medium">{metricItem.metric}</TableCell>
                                <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                    {renderStars(metricItem.score)}
                                </div>
                                ({metricItem.score}/5)
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{metricItem.feedback}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </ScrollArea>
                    ) : (
                    <p className="text-muted-foreground pt-2">No detailed metric scores available.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>

      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-4 border-t mt-2">
        This analysis is AI-generated and should be used as a guide for coaching and improvement. Call recording and transcript quality can impact analysis accuracy.
      </CardFooter>
    </Card>
  );
}

