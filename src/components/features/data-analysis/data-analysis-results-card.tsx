
"use client";

import type { DataAnalysisOutput as DataAnalysisStrategyOutput, DataAnalysisInput } from "@/ai/flows/data-analyzer"; // Renamed for clarity
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ListChecks, Info, FileText, BarChartHorizontalBig, DatabaseZap, MessageCircleWarning, TrendingUp, Target, CheckSquare, AlertTriangle, Brain, MessageSquareQuote, Forward, BookOpen, Settings, Sigma, LineChart, ListTree, SearchCheck, Goal, TestTube2 } from "lucide-react"; // Added TestTube2
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface DataAnalysisResultsCardProps {
  strategyOutput: DataAnalysisStrategyOutput;
  userAnalysisPrompt?: string;
  fileContext?: DataAnalysisInput['fileDetails'];
}

export function DataAnalysisResultsCard({ strategyOutput, userAnalysisPrompt, fileContext }: DataAnalysisResultsCardProps) {
  
  const renderListItems = (items: string[] | undefined, emptyMessage: string) => {
    if (items && items.length > 0) {
      return (
        <ul className="list-disc list-inside text-muted-foreground space-y-1.5 pl-1 text-sm">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    }
    return <p className="text-muted-foreground italic text-sm">{emptyMessage}</p>;
  };

  const formatFileContext = (files?: DataAnalysisInput['fileDetails']): string => {
    if (!files || files.length === 0) return "No file context provided.";
    return files.map(f => `- ${f.fileName} (Type: ${f.fileType || 'unknown'})`).join('\n');
  }

  return (
    <Card className="w-full max-w-4xl shadow-xl mt-8"> {/* Ensure sufficient width for playbook */}
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <Brain className="mr-3 h-6 w-6" /> {strategyOutput.analysisTitle || "Data Analysis Strategic Playbook"}
        </CardTitle>
        <CardDescription className="text-xs">
          AI-Generated strategic guidance based on your prompt and file context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Accordion type="multiple" defaultValue={['item-summary', 'item-inputs', 'item-direct-insights']} className="w-full space-y-2"> {/* Added item-direct-insights to defaultOpen */}
          
           <AccordionItem value="item-inputs">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Info className="mr-2 h-5 w-5 text-accent"/>Your Inputs Overview</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-1">
                {userAnalysisPrompt && (
                    <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Your Analysis Prompt:</h4>
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

          {strategyOutput.directInsightsFromSampleText && (
            <AccordionItem value="item-direct-insights">
              <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                  <div className="flex items-center"><TestTube2 className="mr-2 h-5 w-5 text-accent"/>Direct Insights from Sampled Data (CSV/TXT)</div>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                  <p className="text-sm text-muted-foreground whitespace-pre-line bg-accent/10 p-3 rounded-md">{strategyOutput.directInsightsFromSampleText}</p>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="item-summary">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><ListTree className="mr-2 h-5 w-5 text-accent"/>Executive Summary</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                 <p className="text-sm text-muted-foreground whitespace-pre-line">{strategyOutput.executiveSummary || "No summary provided."}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-prep">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Settings className="mr-2 h-5 w-5 text-accent"/>Data Understanding & Preparation Guide</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-line">{strategyOutput.dataUnderstandingAndPreparationGuide || "No guidance provided."}</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-kpis">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Sigma className="mr-2 h-5 w-5 text-accent"/>Key Metrics & KPIs to Focus On</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                 {renderListItems(strategyOutput.keyMetricsAndKPIsToFocusOn, "No specific KPIs were highlighted.")}
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-analytical-steps">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-accent"/>Suggested Analytical Steps</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
                {strategyOutput.suggestedAnalyticalSteps && strategyOutput.suggestedAnalyticalSteps.length > 0 ? (
                    strategyOutput.suggestedAnalyticalSteps.map((section, index) => (
                        <div key={index} className="p-2 border-l-2 border-accent bg-muted/20 rounded-r-md">
                            <h4 className="font-medium text-sm text-accent-foreground/90 mb-1">{section.area}</h4>
                            <p className="text-xs text-muted-foreground whitespace-pre-line">{section.steps}</p>
                        </div>
                    ))
                ) : <p className="text-muted-foreground italic text-sm">No specific analytical steps suggested.</p>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-viz">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-accent"/>Visualization Recommendations</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-1">
                {strategyOutput.visualizationRecommendations && strategyOutput.visualizationRecommendations.length > 0 ? (
                    strategyOutput.visualizationRecommendations.map((viz, index) => (
                         <div key={index} className="text-sm">
                            <span className="font-medium text-foreground/90">{viz.chartType}:</span> <span className="text-muted-foreground">{viz.description}</span>
                         </div>
                    ))
                ) : <p className="text-muted-foreground italic text-sm">No specific visualization recommendations.</p>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-integrity">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><SearchCheck className="mr-2 h-5 w-5 text-accent"/>Potential Data Integrity Checks</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                {renderListItems(strategyOutput.potentialDataIntegrityChecks, "No specific data integrity checks suggested.")}
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-strat-recommendations">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-accent"/>Strategic Recommendations (Post-Analysis)</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                {renderListItems(strategyOutput.strategicRecommendationsForUser, "No specific strategic recommendations to investigate were provided.")}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-revenue-improvement">
            <AccordionTrigger className="text-md font-semibold hover:no-underline py-2 text-foreground/90">
                <div className="flex items-center"><Goal className="mr-2 h-5 w-5 text-accent"/>Top Revenue Improvement Areas to Investigate</div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                 {renderListItems(strategyOutput.topRevenueImprovementAreasToInvestigate, "No specific revenue improvement areas to investigate were provided.")}
            </AccordionContent>
          </AccordionItem>

        </Accordion>        
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-3 border-t mt-2 bg-background/70 rounded-b-lg">
           <div className="flex items-start">
            <MessageCircleWarning className="mr-2 h-4 w-4 text-amber-600 shrink-0 mt-0.5" /> 
            <p className="whitespace-pre-line">{strategyOutput.limitationsAndDisclaimer || "This is an AI-generated strategic guide. Always validate findings with your actual data using appropriate tools."}</p>
           </div>
      </CardFooter>
    </Card>
  );
}

    

    