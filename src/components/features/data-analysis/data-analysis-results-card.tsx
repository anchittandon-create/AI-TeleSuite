
"use client";

import type { DataAnalysisReportOutput, DataAnalysisInput } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ListChecks, Info, FileText, BarChartHorizontalBig, DatabaseZap, MessageCircleWarning, TrendingUp, Target, CheckSquare, AlertTriangle, Brain, MessageSquareQuote, Forward, BookOpen, Settings, Sigma, LineChart, ListTree, SearchCheck, Goal, TestTube2, HandCoins, Users, CalendarDays, Activity, DraftingCompass, TableIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface DataAnalysisResultsCardProps {
  reportOutput: DataAnalysisReportOutput;
  userAnalysisPrompt?: string;
  fileContext?: DataAnalysisInput['fileDetails'];
}

export function DataAnalysisResultsCard({ reportOutput, userAnalysisPrompt, fileContext }: DataAnalysisResultsCardProps) {
  
  const formatFileContext = (files?: DataAnalysisInput['fileDetails']): string => {
    if (!files || files.length === 0) return "No file context provided.";
    return files.map((fileDetail) => `- ${fileDetail.fileName} (Type: ${fileDetail.fileType || 'unknown'})`).join('\n');
  }

  const defaultOpenAccordions = [
    'item-inputs',
    'item-exec-summary',
    'item-key-metrics',
    'item-detailed-analysis',
    'item-recommendations',
  ];
  if (reportOutput.directInsightsFromSampleText) {
    defaultOpenAccordions.push('item-direct-insights');
  }
  if (reportOutput.chartsOrTablesSuggestions && reportOutput.chartsOrTablesSuggestions.length > 0) {
    defaultOpenAccordions.push('item-charts-tables');
  }


  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <Brain className="mr-3 h-6 w-6" /> {reportOutput.reportTitle || "Data Analysis Report"}
        </CardTitle>
        <CardDescription className="text-xs">
          AI-Generated analysis based on your prompt and file context. Scroll to view all sections.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full space-y-1">
          
           <AccordionItem value="item-inputs">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                <div className="flex items-center"><Settings className="mr-2 h-5 w-5 text-accent"/>Your Inputs Overview</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                {userAnalysisPrompt && (
                    <div>
                        <h4 className="font-medium text-xs text-muted-foreground mb-1">Your Specific Analysis Prompt:</h4>
                        <ScrollArea className="h-28 mt-1 rounded-md border p-2 bg-background/50">
                             <p className="text-xs text-foreground whitespace-pre-line">{userAnalysisPrompt}</p>
                        </ScrollArea>
                    </div>
                )}
                 {fileContext && fileContext.length > 0 && (
                    <div>
                        <h4 className="font-medium text-xs text-muted-foreground mb-1">File Context Provided (Names & Types):</h4>
                         <ScrollArea className="h-20 mt-1 rounded-md border p-2 bg-background/50">
                            <pre className="text-xs text-foreground whitespace-pre-line">{formatFileContext(fileContext)}</pre>
                        </ScrollArea>
                    </div>
                )}
                 {!userAnalysisPrompt && (!fileContext || fileContext.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No specific prompt or file context was recorded for this analysis.</p>
                 )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-exec-summary">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                <div className="flex items-center"><ListTree className="mr-2 h-5 w-5 text-accent"/>Executive Summary</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                 <p className="text-sm text-foreground whitespace-pre-line">{reportOutput.executiveSummary || "No executive summary provided."}</p>
            </AccordionContent>
          </AccordionItem>

          {reportOutput.directInsightsFromSampleText && (
            <AccordionItem value="item-direct-insights">
              <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                  <div className="flex items-center"><TestTube2 className="mr-2 h-5 w-5 text-accent"/>Direct Insights from Sampled Data (CSV/TXT)</div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md">
                  <p className="text-sm text-foreground whitespace-pre-line">{reportOutput.directInsightsFromSampleText}</p>
              </AccordionContent>
            </AccordionItem>
          )}
          
          <AccordionItem value="item-key-metrics">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                <div className="flex items-center"><Sigma className="mr-2 h-5 w-5 text-accent"/>Key Metrics & KPIs</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md space-y-2">
                 {reportOutput.keyMetrics && reportOutput.keyMetrics.length > 0 ? (
                    reportOutput.keyMetrics.map((metric, index) => (
                        <div key={index} className="p-2 border-l-2 border-primary bg-background/50 rounded-r-sm">
                            <h4 className="font-medium text-sm text-primary-foreground/90 mb-0.5">{metric.metricName}: <span className="font-bold text-foreground">{metric.value}</span></h4>
                            {metric.trendOrComparison && <p className="text-xs text-muted-foreground">Trend/Comparison: {metric.trendOrComparison}</p>}
                            {metric.insight && <p className="text-xs text-muted-foreground italic">Insight: {metric.insight}</p>}
                        </div>
                    ))
                 ) : <p className="text-foreground italic text-sm">No specific key metrics highlighted.</p>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-detailed-analysis">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                <div className="flex items-center"><DraftingCompass className="mr-2 h-5 w-5 text-accent"/>Detailed Analysis Findings</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md space-y-3">
                 {reportOutput.detailedAnalysis.timeSeriesTrends && (
                    <div>
                        <h4 className="font-medium text-sm text-foreground/90 mb-1 flex items-center"><TrendingUp className="mr-1.5 h-4 w-4"/>Time-Series Trends:</h4>
                        <p className="text-sm text-foreground whitespace-pre-line">{reportOutput.detailedAnalysis.timeSeriesTrends}</p>
                    </div>
                 )}
                 {reportOutput.detailedAnalysis.comparativePerformance && (
                    <div>
                        <h4 className="font-medium text-sm text-foreground/90 mb-1 flex items-center"><Users className="mr-1.5 h-4 w-4"/>Comparative Performance:</h4>
                        <p className="text-sm text-foreground whitespace-pre-line">{reportOutput.detailedAnalysis.comparativePerformance}</p>
                    </div>
                 )}
                 {reportOutput.detailedAnalysis.useCaseSpecificInsights && (
                     <div>
                        <h4 className="font-medium text-sm text-foreground/90 mb-1 flex items-center"><Lightbulb className="mr-1.5 h-4 w-4"/>Use-Case Specific Insights:</h4>
                        <p className="text-sm text-foreground whitespace-pre-line">{reportOutput.detailedAnalysis.useCaseSpecificInsights}</p>
                    </div>
                 )}
                 {!reportOutput.detailedAnalysis.timeSeriesTrends && !reportOutput.detailedAnalysis.comparativePerformance && !reportOutput.detailedAnalysis.useCaseSpecificInsights && (
                    <p className="text-foreground italic text-sm">No detailed analysis findings provided in these categories.</p>
                 )}
            </AccordionContent>
          </AccordionItem>

          {reportOutput.chartsOrTablesSuggestions && reportOutput.chartsOrTablesSuggestions.length > 0 && (
            <AccordionItem value="item-charts-tables">
              <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                  <div className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-accent"/>Chart/Table Suggestions</div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md space-y-2">
                  {reportOutput.chartsOrTablesSuggestions.map((suggestion, index) => (
                      <div key={index} className="p-2 border rounded-sm bg-background/50">
                          <h4 className="font-medium text-sm text-foreground/90 mb-0.5 flex items-center">
                            {suggestion.type.includes("Chart") ? <BarChartHorizontalBig className="mr-1.5 h-4 w-4"/> : <TableIcon className="mr-1.5 h-4 w-4"/>}
                            Suggested {suggestion.type}: {suggestion.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                      </div>
                  ))}
              </AccordionContent>
            </AccordionItem>
          )}
          
          <AccordionItem value="item-recommendations">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90 [&_svg]:mr-2">
                <div className="flex items-center"><Goal className="mr-2 h-5 w-5 text-accent"/>Recommendations</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-sm bg-muted/20 p-3 rounded-b-md space-y-3">
                {reportOutput.recommendations && reportOutput.recommendations.length > 0 ? (
                    reportOutput.recommendations.map((rec, index) => (
                        <div key={index} className="p-2 border-l-2 border-primary bg-background/50 rounded-r-sm">
                            <h4 className="font-medium text-sm text-primary-foreground/90 mb-1">Recommendation for: {rec.area}</h4>
                            <p className="text-xs text-foreground font-semibold">Action: <span className="font-normal">{rec.recommendation}</span></p>
                            {rec.justification && <p className="text-xs text-muted-foreground mt-0.5">Justification: <span className="italic">{rec.justification}</span></p>}
                        </div>
                    ))
                ) : <p className="text-foreground italic text-sm">No specific recommendations provided.</p>}
            </AccordionContent>
          </AccordionItem>

        </Accordion>        
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-3 border-t mt-2 bg-background/70 rounded-b-lg">
           <div className="flex items-start">
            <MessageCircleWarning className="mr-2 h-4 w-4 text-amber-600 shrink-0 mt-0.5" /> 
            <p className="whitespace-pre-line">{reportOutput.limitationsAndDisclaimer || "This is an AI-generated analysis. Always validate findings with your actual data using appropriate tools."}</p>
           </div>
      </CardFooter>
    </Card>
  );
}

    
