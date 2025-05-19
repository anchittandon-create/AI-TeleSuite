
"use client";

import type { ScoreCallOutput } from "@/ai/flows/call-scoring";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star } from "lucide-react";

interface CallScoringResultsCardProps {
  results: ScoreCallOutput;
}

export function CallScoringResultsCard({ results }: CallScoringResultsCardProps) {
  const renderStars = (score: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-6 w-6 ${i <= score ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
        />
      );
    }
    return stars;
  };

  return (
    <Card className="w-full max-w-2xl shadow-xl mt-8">
      <CardHeader>
        <CardTitle className="text-2xl text-primary">Call Analysis Report</CardTitle>
        <CardDescription>Detailed breakdown of the call scoring.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-2">Overall Score</h3>
          <div className="flex items-center gap-2">
            {renderStars(results.score)}
            <span className="text-xl font-bold text-foreground ml-2">{results.score} / 5</span>
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold text-lg mb-2">Areas for Improvement</h3>
          {results.tags && results.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {results.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">{tag}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No specific areas for improvement flagged. Great job!</p>
          )}
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold text-lg mb-1">Call Transcript</h3>
          <ScrollArea className="h-60 w-full rounded-md border p-3 bg-muted/30">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {results.transcript || "Transcript not available."}
            </p>
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
        This analysis is AI-generated and should be used as a guide.
      </CardFooter>
    </Card>
  );
}
