
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star,ThumbsUp, ThumbsDown, Target, Info, FileText, StarHalf } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
  fileName?: string;
}

export function CallScoringResultsCard({ results, fileName }: CallScoringResultsCardProps) {
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

  const getCategoryBadgeVariant = (category: string | undefined): "default" | "secondary" | "destructive" | "outline" => {
    switch (category?.toLowerCase()) {
      case 'excellent':
        return 'default'; // primary color
      case 'good':
        return 'secondary'; // greenish (adjust theme if needed)
      case 'fair':
        return 'outline'; // yellowish/orangish (adjust theme if needed)
      case 'needs improvement':
      case 'poor':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl text-primary flex items-center">
              <Info className="mr-3 h-7 w-7" /> Call Performance Report
            </CardTitle>
            {fileName && <CardDescription>Analysis for: {fileName}</CardDescription>}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1">
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
        <Separator />
        
        <div>
          <h3 className="font-semibold text-lg mb-2 flex items-center"><FileText className="mr-2 h-5 w-5 text-accent"/>Call Transcript</h3>
          <ScrollArea className="h-60 w-full rounded-md border p-3 bg-muted/20">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {results.transcript || "Transcript not available."}
            </p>
          </ScrollArea>
        </div>
        
        <Separator />

        <div>
          <h3 className="font-semibold text-lg mb-2">Overall Summary</h3>
          <p className="text-muted-foreground">{results.summary || "No summary provided."}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
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

        <Separator />

        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center"><Target className="mr-2 h-5 w-5 text-accent"/>Metric-wise Breakdown</h3>
          {results.metricScores && results.metricScores.length > 0 ? (
            <ScrollArea className="max-h-[400px] overflow-y-auto">
              <Table className="border rounded-md">
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-[30%]">Metric</TableHead>
                    <TableHead className="w-[15%] text-center">Score</TableHead>
                    <TableHead>Feedback</TableHead>
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
            <p className="text-muted-foreground">No detailed metric scores available.</p>
          )}
        </div>

      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
        This analysis is AI-generated and should be used as a guide for coaching and improvement.
      </CardFooter>
    </Card>
  );
}
