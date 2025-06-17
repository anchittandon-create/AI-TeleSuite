
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Star,ThumbsUp, ThumbsDown, Target, Info, FileText, StarHalf, ShieldCheck, ShieldAlert, Mic, PlayCircle, AlertCircle, ListChecks, Newspaper, MessageSquare, CheckSquare, TrendingUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CallScoreCategory } from "@/types";
import React, { useRef, useEffect } from 'react';

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
  audioDataUri?: string;
  isHistoricalView?: boolean;
}

const mapAccuracyToPercentageString = (assessment: string): string => {
  if (!assessment) return "N/A";
  const lowerAssessment = assessment.toLowerCase();
  if (lowerAssessment.includes("high")) return "High (est. 95%+)";
  if (lowerAssessment.includes("medium")) return "Medium (est. 80-94%)";
  if (lowerAssessment.includes("low")) return "Low (est. <80%)";
  if (lowerAssessment.includes("error")) return "Error";
  return assessment;
};

const getMetricPerformanceString = (score: number): string => {
  if (score <= 1.5) return "Poor";
  if (score <= 2.5) return "Needs Improvement";
  if (score <= 3.5) return "Average";
  if (score <= 4.5) return "Good";
  return "Excellent";
};


export function CallScoringResultsCard({ results, fileName, audioDataUri, isHistoricalView = false }: CallScoringResultsCardProps) {
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const player = audioPlayerRef.current;
    return () => {
      if (player) {
        player.pause();
        player.removeAttribute('src');
        player.load();
      }
    };
  }, []);

  useEffect(() => {
    if (audioPlayerRef.current && audioDataUri && !isHistoricalView) {
      audioPlayerRef.current.src = audioDataUri;
    } else if (audioPlayerRef.current && (!audioDataUri || isHistoricalView)) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.removeAttribute('src');
      audioPlayerRef.current.load();
    }
  }, [audioDataUri, isHistoricalView]);


  const renderStars = (score: number, size: 'sm' | 'md' = 'md') => {
    const stars = [];
    const starClass = size === 'sm' ? "h-4 w-4" : "h-5 w-5";
    for (let i = 1; i <= 5; i++) {
      if (score >= i) {
        stars.push(<Star key={i} className={`${starClass} text-yellow-400 fill-yellow-400`} />);
      } else if (score >= i - 0.5) {
        stars.push(<StarHalf key={i} className={`${starClass} text-yellow-400 fill-yellow-400`} />);
      } else {
        stars.push(<Star key={i} className={`${starClass} text-muted-foreground/50`} />);
      }
    }
    return stars;
  };

  const getCategoryBadgeVariant = (category?: CallScoreCategory | string): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'very good':
      case 'excellent': // Adding excellent to match performance string
        return 'default'; // Greenish or primary
      case 'good':
        return 'secondary'; // Lighter green or secondary
      case 'average':
      case 'fair': // Adding fair
        return 'outline';
      case 'bad':
      case 'very bad':
      case 'poor': // Adding poor
      case 'needs improvement': // Adding needs improvement
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
      <CardHeader className="pb-0">
        <div className="flex justify-between items-start flex-wrap gap-y-2">
          <div>
            <CardTitle className="text-xl text-primary flex items-center">
              <Mic className="mr-3 h-6 w-6" /> Call Scoring Report
            </CardTitle>
            {fileName && <CardDescription>Analysis for: {fileName}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
            <TabsTrigger value="overall" className="text-xs sm:text-sm"><ListChecks className="mr-1.5 h-4 w-4"/>Overall Scoring</TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs sm:text-sm"><Newspaper className="mr-1.5 h-4 w-4"/>Transcript</TabsTrigger>
            <TabsTrigger value="detailed-metrics" className="text-xs sm:text-sm"><Star className="mr-1.5 h-4 w-4"/>Detailed Metrics</TabsTrigger>
            <TabsTrigger value="strengths" className="text-xs sm:text-sm"><ThumbsUp className="mr-1.5 h-4 w-4"/>Strengths</TabsTrigger>
            <TabsTrigger value="improvements" className="text-xs sm:text-sm"><TrendingUp className="mr-1.5 h-4 w-4"/>Improvements</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="mt-0">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-1 py-3 bg-secondary/50 rounded-lg">
                <div className="flex justify-between items-center ">
                    <h3 className="text-lg font-semibold text-foreground pl-2">{fileName || "Call Analysis"}</h3>
                    <div className="flex items-center gap-2 pr-2">
                        <Badge variant={getCategoryBadgeVariant(results.callCategorisation)} className="text-sm px-3 py-1">
                            {results.callCategorisation}
                        </Badge>
                        <span className="text-xl font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">{results.overallScore.toFixed(1)}/5</span>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-1 space-y-4">
                <div>
                  <h4 className="font-semibold text-md mb-1 text-foreground">Call Summary</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line bg-background p-3 rounded-md border">
                    {results.summary || "No summary provided."}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-md mb-2 text-foreground">Score Overview</h4>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-semibold text-foreground/80">Metric</TableHead>
                          <TableHead className="text-center font-semibold text-foreground/80">Score</TableHead>
                          <TableHead className="font-semibold text-foreground/80">Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(results.metricScores || []).map((metric, index) => (
                          <TableRow key={`overview-metric-${index}`} className="text-sm">
                            <TableCell className="py-2.5">{metric.metric}</TableCell>
                            <TableCell className="text-center py-2.5">
                                <Badge variant={getCategoryBadgeVariant(getMetricPerformanceString(metric.score))} className="text-xs">
                                    {metric.score}/5
                                </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground">{getMetricPerformanceString(metric.score)}</TableCell>
                          </TableRow>
                        ))}
                         {(!results.metricScores || results.metricScores.length === 0) && (
                            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-3">No metric scores available for overview.</TableCell></TableRow>
                         )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript" className="mt-0">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-1 py-3">
                 <h3 className="text-lg font-semibold text-foreground">Call Transcript</h3>
              </CardHeader>
              <CardContent className="pt-2 px-1 space-y-3">
                {isHistoricalView && !audioDataUri && (
                  <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <Label className="flex items-center mb-1 font-medium text-sm text-amber-700">
                      <AlertCircle className="mr-2 h-5 w-5" /> Note on Historical Audio
                    </Label>
                    <p className="text-xs text-amber-600">
                      Original audio file is not available for playback or download in historical dashboard views.
                    </p>
                  </div>
                )}
                {audioDataUri && !isHistoricalView && (
                  <div className="mb-3">
                    <Label htmlFor={`audio-player-scoring-transcript-${fileName?.replace(/[^a-zA-Z0-9]/g, "") || 'default'}`} className="flex items-center mb-1 font-semibold text-sm">
                        <PlayCircle className="mr-2 h-5 w-5 text-primary" /> Original Audio
                    </Label>
                    <audio
                      id={`audio-player-scoring-transcript-${fileName?.replace(/[^a-zA-Z0-9]/g, "") || 'default'}`}
                      controls
                      src={audioDataUri}
                      ref={audioPlayerRef}
                      className="w-full h-10"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2" title={`Transcript Accuracy: ${results.transcriptAccuracy}`}>
                    {getAccuracyIcon(results.transcriptAccuracy)}
                    <span>{mapAccuracyToPercentageString(results.transcriptAccuracy || "N/A")}</span>
                </div>
                <ScrollArea className="h-60 w-full rounded-md border p-3 bg-background">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {results.transcript || "Transcript not available."}
                  </p>
                </ScrollArea>
                {results.transcriptAccuracy && results.transcriptAccuracy.toLowerCase().includes("low") && (
                  <p className="text-xs text-destructive mt-1">Note: Transcript accuracy is low. Scoring may be impacted.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed-metrics" className="mt-0">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-1 py-3">
                 <h3 className="text-lg font-semibold text-foreground">Metric-wise Breakdown</h3>
              </CardHeader>
              <CardContent className="pt-2 px-1">
                {(results.metricScores && results.metricScores.length > 0) ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[25%] font-semibold text-foreground/80">Metric</TableHead>
                        <TableHead className="w-[15%] text-center font-semibold text-foreground/80">Score</TableHead>
                        <TableHead className="font-semibold text-foreground/80">Feedback & Observations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.metricScores.map((metricItem, index) => (
                        <TableRow key={`detailed-metric-${index}`} className="text-sm">
                          <TableCell className="font-medium py-2.5">{metricItem.metric}</TableCell>
                          <TableCell className="text-center py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              {renderStars(metricItem.score, 'sm')}
                            </div>
                            <span className="text-xs">({metricItem.score}/5)</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-pre-line">{metricItem.feedback}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                ) : (
                  <p className="text-muted-foreground text-sm p-3">No detailed metric scores available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="strengths" className="mt-0">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-1 py-3">
                 <h3 className="text-lg font-semibold text-foreground">Key Strengths Observed</h3>
              </CardHeader>
              <CardContent className="pt-2 px-1">
                {results.strengths && results.strengths.length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 pl-2 bg-background p-3 rounded-md border">
                    {results.strengths.map((item, index) => (
                      <li key={`strength-${index}`} className="flex items-start">
                        <CheckSquare className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0"/>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic p-3">No specific strengths highlighted by the AI.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="improvements" className="mt-0">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-1 py-3">
                 <h3 className="text-lg font-semibold text-foreground">Areas for Improvement</h3>
              </CardHeader>
              <CardContent className="pt-2 px-1">
                {results.areasForImprovement && results.areasForImprovement.length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 pl-2 bg-background p-3 rounded-md border">
                    {results.areasForImprovement.map((item, index) => (
                       <li key={`improvement-${index}`} className="flex items-start">
                        <MessageSquare className="h-4 w-4 text-amber-500 mr-2 mt-0.5 shrink-0"/>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic p-3">No specific areas for improvement highlighted by the AI.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-3 border-t mt-2">
        This analysis is AI-generated and should be used as a guide for coaching and improvement. Call recording and transcript quality can impact analysis accuracy.
      </CardFooter>
    </Card>
  );
}
