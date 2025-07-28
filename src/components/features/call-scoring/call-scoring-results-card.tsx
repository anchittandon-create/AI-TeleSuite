
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Star, AlertCircle, ListChecks, CheckSquare, MessageSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CallScoreCategory } from "@/types";
import { format, parseISO } from 'date-fns';

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
  isHistoricalView?: boolean;
  timestamp?: string; // For historical view
  agentName?: string; // For historical view
  product?: string; // For historical view
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

export function CallScoringResultsCard({ results, fileName, isHistoricalView = false, timestamp, agentName, product }: CallScoringResultsCardProps) {

  const displayTimestamp = timestamp ? format(parseISO(timestamp), 'PP p') : new Date().toLocaleDateString();

  return (
    <Card className="w-full max-w-4xl shadow-xl mt-4 border-primary/20 bg-card">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold text-primary">
          Call Scoring Report
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-6 lg:px-8 space-y-6">
        
        {/* Metadata Section */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm p-4 rounded-lg bg-secondary/30 border">
          <div>
            <p><strong className="font-medium text-foreground/80">File Name:</strong> <span className="text-muted-foreground">{fileName || "N/A"}</span></p>
            <p><strong className="font-medium text-foreground/80">Agent Name:</strong> <span className="text-muted-foreground">{agentName || "N/A"}</span></p>
            <p><strong className="font-medium text-foreground/80">Product Focus:</strong> <span className="text-muted-foreground">{product || "General"}</span></p>
          </div>
          <div className="text-right">
            <p><strong className="font-medium text-foreground/80">Date Scored:</strong> <span className="text-muted-foreground">{displayTimestamp}</span></p>
            <p><strong className="font-medium text-foreground/80">Overall Score:</strong> <span className="text-muted-foreground">{results.overallScore.toFixed(1)}/5 ({getPerformanceStringFromScore(results.overallScore)})</span></p>
          </div>
        </div>

        {/* Summary Section */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Summary</h3>
          <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border leading-relaxed">
            {results.summary || "No summary provided."}
          </p>
        </div>

        {/* Strengths & Improvements */}
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
        
        {/* Detailed Metrics Table */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Detailed Metric Scores</h3>
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

      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-3 border-t mt-2 px-6">
        <AlertCircle className="mr-2 h-4 w-4 shrink-0"/>
        This analysis is AI-generated and should be used as a guide for coaching and improvement.
      </CardFooter>
    </Card>
  );
}
