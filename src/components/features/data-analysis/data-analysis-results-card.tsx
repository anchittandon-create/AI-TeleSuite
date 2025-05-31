
"use client";

import type { DataAnalysisOutput } from "@/ai/flows/data-analyzer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ListChecks, Info, FileText, BarChartHorizontalBig, DatabaseZap, MessageCircleWarning } from "lucide-react"; // Added new icons
import { ScrollArea } from "@/components/ui/scroll-area";

interface DataAnalysisResultsCardProps {
  results: DataAnalysisOutput;
  fileName?: string;
  userDescription?: string;
}

export function DataAnalysisResultsCard({ results, fileName, userDescription }: DataAnalysisResultsCardProps) {
  return (
    <Card className="w-full max-w-3xl shadow-xl mt-8">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <FileText className="mr-3 h-6 w-6" /> {results.analysisTitle || "Data Analysis Report"}
        </CardTitle>
        {fileName && <CardDescription>Analysis for file: <strong>{fileName}</strong></CardDescription>}
        {userDescription && <CardDescription className="mt-1">Your goal/description: <em>"{userDescription}"</em></CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><Info className="mr-2 h-5 w-5 text-accent"/>Summary</h3>
          <p className="text-muted-foreground whitespace-pre-line">{results.summary || "No summary provided."}</p>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-accent"/>Key Insights</h3>
          {results.keyInsights && results.keyInsights.length > 0 ? (
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
              {results.keyInsights.map((item, index) => (
                <li key={`insight-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No specific key insights highlighted.</p>
          )}
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent"/>Potential Patterns / Trends</h3>
          {results.potentialPatterns && results.potentialPatterns.length > 0 ? (
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
              {results.potentialPatterns.map((item, index) => (
                <li key={`pattern-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No specific patterns or trends highlighted.</p>
          )}
        </div>
        <Separator />
         <div>
          <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-accent"/>Suggested Visualizations</h3>
          {results.suggestedVisualizations && results.suggestedVisualizations.length > 0 ? (
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
              {results.suggestedVisualizations.map((item, index) => (
                <li key={`viz-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No specific visualizations suggested.</p>
          )}
        </div>
        
        {results.extractedTableSample && (
            <>
                <Separator />
                <div>
                <h3 className="font-semibold text-md mb-1 text-foreground flex items-center"><DatabaseZap className="mr-2 h-5 w-5 text-accent"/>Extracted Table Sample (from text content)</h3>
                <ScrollArea className="max-h-40 w-full rounded-md border p-2 bg-muted/30">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {results.extractedTableSample}
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
