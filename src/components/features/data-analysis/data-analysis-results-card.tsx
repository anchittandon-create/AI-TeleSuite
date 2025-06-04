
"use client";

import type { DataAnalysisReportOutput, DataAnalysisInput } from "@/ai/flows/data-analyzer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ListChecks, Info, FileText, BarChartHorizontalBig, DatabaseZap, MessageCircleWarning, TrendingUp, Target, CheckSquare, AlertTriangle, Brain, MessageSquareQuote, Forward, BookOpen, Settings, Sigma, LineChart, ListTree, SearchCheck, Goal, TestTube2, HandCoins, Users, CalendarDays, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface DataAnalysisResultsCardProps {
  reportOutput: DataAnalysisReportOutput; // Changed from strategyOutput
  userAnalysisPrompt?: string;
  fileContext?: DataAnalysisInput['fileDetails'];
}

export function DataAnalysisResultsCard({ reportOutput, userAnalysisPrompt, fileContext }: DataAnalysisResultsCardProps) {
  
  const formatFileContext = (files?: DataAnalysisInput['fileDetails']): string => {
    if (!files || files.length === 0) return "No file context provided.";
    return files.map(f => `- ${f.fileName} (Type: ${f.fileType || 'unknown'})`).join('\n');
  }

  // Open all primary content sections by default to show the full report.
  const defaultOpenAccordions = [
    'item-inputs',
    'item-exec-summary',
    'item-trends',
    'item-agent-perf',
    'item-cohort-analysis',
    'item-call-handling',
    'item-lead-quality',
    'item-incentives',
    'item-recommendations',
  ];
  // Add direct insights section if it exists, as it's optional in the schema.
  if (reportOutput.directInsightsFromSampleText) {
    defaultOpenAccordions.push('item-direct-insights');
  }


  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <Brain className="mr-3 h-6 w-6" /> {reportOutput.reportTitle || "Data Analysis Report"}
        </CardTitle>
        <CardDescription className="text-xs">
          AI-Generated analysis based on your prompt and file context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full space-y-2">
          
           <AccordionItem value="item-inputs">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Info className="mr-2 h-5 w-5 text-accent"/>Your Inputs Overview</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-1">
                {userAnalysisPrompt && (
                    <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Your Specific Analysis Prompt:</h4>
                        <ScrollArea className="h-28 mt-1 rounded-md border p-2 bg-muted/25">
                             <p className="text-xs text-foreground whitespace-pre-line">{userAnalysisPrompt}</p>
                        </ScrollArea>
                    </div>
                )}
                 {fileContext && fileContext.length > 0 && (
                    <div>
                        <h4 className="font-medium text-sm text-muted-foreground">File Context Provided:</h4>
                         <ScrollArea className="h-20 mt-1 rounded-md border p-2 bg-muted/25">
                            <pre className="text-xs text-foreground whitespace-pre-line">{formatFileContext(fileContext)}</pre>
                        </ScrollArea>
                    </div>
                )}
            </AccordionContent>
          </AccordionItem>

          {reportOutput.directInsightsFromSampleText && (
            <AccordionItem value="item-direct-insights">
              <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                  <div className="flex items-center"><TestTube2 className="mr-2 h-5 w-5 text-accent"/>Direct Insights from Sampled Data (CSV/TXT)</div>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                  <p className="text-sm text-muted-foreground whitespace-pre-line bg-accent/10 p-3 rounded-md">{reportOutput.directInsightsFromSampleText}</p>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="item-exec-summary">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><ListTree className="mr-2 h-5 w-5 text-accent"/>Executive Summary</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                 <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.executiveSummary || "No executive summary provided."}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-trends">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-accent"/>Key Monthly Trends</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.keyMonthlyTrends || "No trend analysis provided."}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-agent-perf">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Users className="mr-2 h-5 w-5 text-accent"/>Agent & Team Performance</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.agentTeamPerformance || "No agent/team performance analysis provided."}</p>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-cohort-analysis">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-accent"/>Cohort Analysis</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.cohortAnalysis || "No cohort analysis provided."}</p>
            </AccordionContent>
          </AccordionItem>

           <AccordionItem value="item-call-handling">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Activity className="mr-2 h-5 w-5 text-accent"/>Call Handling Efficiency</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.callHandlingEfficiency || "No call handling efficiency analysis provided."}</p>
            </AccordionContent>
          </AccordionItem>

           <AccordionItem value="item-lead-quality">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><SearchCheck className="mr-2 h-5 w-5 text-accent"/>Lead Quality & Follow-Up Discipline</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.leadQualityAndFollowUp || "No lead quality/follow-up analysis provided."}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-incentives">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><HandCoins className="mr-2 h-5 w-5 text-accent"/>Incentive Effectiveness</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                 <p className="text-sm text-muted-foreground whitespace-pre-line">{reportOutput.incentiveEffectiveness || "No incentive effectiveness analysis provided."}</p>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-recommendations">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Goal className="mr-2 h-5 w-5 text-accent"/>Recommendations with Data Backing</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
                {reportOutput.recommendationsWithDataBacking && reportOutput.recommendationsWithDataBacking.length > 0 ? (
                    reportOutput.recommendationsWithDataBacking.map((rec, index) => (
                        <div key={index} className="p-2 border-l-2 border-primary bg-muted/20 rounded-r-md">
                            <h4 className="font-medium text-sm text-primary-foreground/90 mb-1">Recommendation for: {rec.area}</h4>
                            <p className="text-xs text-muted-foreground font-semibold">Action: <span className="font-normal">{rec.recommendation}</span></p>
                            {rec.dataBacking && <p className="text-xs text-muted-foreground mt-0.5">Data Backing: <span className="italic">{rec.dataBacking}</span></p>}
                        </div>
                    ))
                ) : <p className="text-muted-foreground italic text-sm">No specific recommendations provided.</p>}
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

    
