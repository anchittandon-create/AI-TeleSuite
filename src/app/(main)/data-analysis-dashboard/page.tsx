
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisDashboardTable } from '@/components/features/data-analysis-dashboard/dashboard-table'; 
import type { HistoricalAnalysisStrategyItem, ActivityLogEntry } from '@/types'; // Updated import
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet as SheetIcon } from 'lucide-react';
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';


export default function DataAnalysisDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const dataAnalysisHistory: HistoricalAnalysisStrategyItem[] = useMemo(() => {
    if (!isClient) return []; 
    return (activities || [])
      .filter(activity => 
        activity.module === "Data Analysis Strategy" && 
        activity.details && 
        typeof activity.details === 'object' &&
        'inputData' in activity.details &&
        typeof (activity.details as any).inputData === 'object' &&
        ('analysisOutput' in activity.details || 'error' in activity.details) 
      )
      .map(activity => activity as ActivityLogEntry as HistoricalAnalysisStrategyItem)  // Cast after filtering
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleExportCsv = () => {
    if (dataAnalysisHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no Data Analysis Strategy history to export.",
      });
      return;
    }
    try {
      const dataForExport = dataAnalysisHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        StrategyTitle: item.details.analysisOutput?.analysisTitle || (item.details.error ? 'Error in generation' : 'N/A'),
        UserPromptSummary: item.details.inputData.userAnalysisPrompt.substring(0,100) + (item.details.inputData.userAnalysisPrompt.length > 100 ? '...' : ''),
        FileContextCount: item.details.inputData.fileDetails.length,
        FileContextNames: item.details.inputData.fileDetails.map(f => f.fileName).join('; ').substring(0,100) + (item.details.inputData.fileDetails.map(f => f.fileName).join('; ').length > 100 ? '...' : ''),
        Error: item.details.error || '',
      }));
      exportToCsv('data_analysis_strategy_history.csv', dataForExport);
      toast({
        title: "Export Successful",
        description: "Data Analysis Strategy history exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export Data Analysis Strategy history to CSV.",
      });
      console.error("Data Analysis Strategy History CSV Export error:", error);
    }
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Data Analysis Strategy Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
         <div className="flex justify-end">
           <Button onClick={handleExportCsv} variant="outline">
            <SheetIcon className="mr-2 h-4 w-4" /> Export All as CSV
          </Button>
        </div>
        {isClient ? (
          <DataAnalysisDashboardTable key={`data-analysis-dashboard-table-${(dataAnalysisHistory || []).length}`} history={dataAnalysisHistory} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of generated Data Analysis Strategies. Each entry provides a playbook based on your detailed prompts and file context. 
          Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}
