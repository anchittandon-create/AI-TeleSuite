
"use client";

import type { DataAnalysisOutput } from "@/ai/flows/data-analyzer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ListChecks, Info, FileText, BarChartHorizontalBig, DatabaseZap, MessageCircleWarning, TrendingUp, Target, CheckSquare, AlertTriangle, Brain, MessageSquareQuote, Forward } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DataAnalysisResultsCardProps {
  results: DataAnalysisOutput;
  fileName?: string;
  userDescription?: string;
}

export function DataAnalysisResultsCard({ results, fileName, userDescription }: DataAnalysisResultsCardProps) {
  const renderListItems = (items: string[] | undefined, emptyMessage: string) => {
    if (items && items.length > 0) {
      return (
        <ul className="list-disc list-inside text-muted-foreground space-y-1.5 pl-1">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    }
    return <p className="text-muted-foreground italic">{emptyMessage}</p>;
  };

  return (
    <Card className="w-full max-w-3xl shadow-xl mt-8">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <Brain className="mr-3 h-6 w-6" /> {results.analysisTitle || "Telecalling Performance Analysis"}
        </CardTitle>
        {fileName && <CardDescription>File Analyzed: <strong>{fileName}</strong></CardDescription>}
        {userDescription && <CardDescription className="mt-1">Your Analysis Goal: <em>"{userDescription}"</em></CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">
        
        <div>
          <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><Info className="mr-2 h-5 w-5 text-accent"/>Data Overview</h3>
          <p className="text-muted-foreground whitespace-pre-line">{results.dataOverview || "No data overview provided."}</p>
        </div>
        <Separator/>

        <div>
          <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent"/>Key Observations & Findings</h3>
          {renderListItems(results.keyObservationsAndFindings, "No specific observations or findings were highlighted.")}
        </div>
        <Separator/>
        
        {results.performanceTrends && (
            <>
                <div>
                <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-accent"/>Performance Trends</h3>
                <p className="text-muted-foreground whitespace-pre-line">{results.performanceTrends}</p>
                </div>
                <Separator/>
            </>
        )}

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
                <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><CheckSquare className="mr-2 h-5 w-5 text-green-500"/>Areas of Strength</h3>
                {renderListItems(results.areasOfStrength, "No specific strengths identified.")}
            </div>
            <div>
                <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-orange-500"/>Areas for Improvement</h3>
                {renderListItems(results.areasForImprovement, "No specific areas for improvement identified.")}
            </div>
        </div>
        <Separator/>
        
        <div>
          <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><Target className="mr-2 h-5 w-5 text-accent"/>Actionable Recommendations</h3>
          {renderListItems(results.actionableRecommendations, "No specific recommendations provided.")}
        </div>
        <Separator/>

        <div>
          <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><Forward className="mr-2 h-5 w-5 text-accent"/>Suggested Next Steps</h3>
          {renderListItems(results.suggestedNextSteps, "No specific next steps suggested.")}
        </div>
        
        {results.extractedDataSample && (
            <>
                <Separator />
                <div>
                <h3 className="font-semibold text-md mb-2 text-foreground flex items-center"><DatabaseZap className="mr-2 h-5 w-5 text-accent"/>Processed Data Sample (from text content)</h3>
                <ScrollArea className="max-h-40 w-full rounded-md border p-2 bg-muted/30">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {results.extractedDataSample}
                    </pre>
                </ScrollArea>
                </div>
            </>
        )}
        
      </CardContent>
      {results.limitationsAcknowledged && (
        <CardFooter className="text-xs text-muted-foreground pt-3 border-t mt-2 bg-background/70 rounded-b-lg">
           <div className="flex items-start">
            <MessageCircleWarning className="mr-2 h-4 w-4 text-amber-600 shrink-0 mt-0.5" /> 
            <p>{results.limitationsAcknowledged}</p>
           </div>
        </CardFooter>
      )}
    </Card>
  );
}
