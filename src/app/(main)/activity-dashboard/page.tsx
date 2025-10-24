
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { ActivityTable } from '@/components/features/activity-dashboard/activity-table';
import { ActivityDashboardFilters, ActivityFilters } from '@/components/features/activity-dashboard/filters';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Sheet, FileText, List, FileSpreadsheet } from 'lucide-react'; 
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { ActivityLogEntry } from '@/types'; 
import { parseISO, startOfDay, endOfDay, format as formatDate } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProductContext } from '@/hooks/useProductContext';


export default function ActivityDashboardPage() {
  const { activities } = useActivityLogger();
  const { availableProducts } = useProductContext();
  const [filters, setFilters] = useState<ActivityFilters>({ product: "All" });
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const availableModules = useMemo(() => {
    if (!isClient) return [];
    const modules = new Set((activities || []).map(a => a.module));
    return Array.from(modules);
  }, [activities, isClient]);

  const filteredActivities = useMemo(() => {
    if (!isClient) return [];
    return (activities || []).filter(activity => {
      if (filters.dateFrom && parseISO(activity.timestamp) < startOfDay(filters.dateFrom)) return false;
      if (filters.dateTo && parseISO(activity.timestamp) > endOfDay(filters.dateTo)) return false;
      if (filters.agentName && !activity.agentName?.toLowerCase().includes(filters.agentName.toLowerCase())) return false;
      if (filters.module && activity.module !== filters.module) return false;
      if (filters.product && filters.product !== "All" && activity.product !== filters.product) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, filters, isClient]);

  const getDetailsPreviewForExport = (details: any): string => {
    if (typeof details === 'string') return details.substring(0,100) + (details.length > 100 ? '...' : '');
    if (typeof details === 'object' && details !== null) {
        if ('error' in details && typeof details.error === 'string') return `Error: ${details.error.substring(0, 80)}...`;
        if ('scoreOutput' in details && typeof details.scoreOutput === 'object' && details.scoreOutput && 'overallScore' in details.scoreOutput) return `Call Scored. Score: ${(details.scoreOutput as any).overallScore ?? 'N/A'}`;
        if ('pitchOutput' in details && typeof details.pitchOutput === 'object' && details.pitchOutput && 'pitchTitle' in details.pitchOutput) return `Pitch: ${(details.pitchOutput as any).pitchTitle?.substring(0,50) || 'N/A'}...`;
        if ('rebuttalOutput' in details && typeof details.rebuttalOutput === 'object' && details.rebuttalOutput && 'rebuttal' in details.rebuttalOutput) return `Rebuttal: ${(details.rebuttalOutput as any).rebuttal?.substring(0,50) || 'N/A'}...`;
        // Updated: Check for segments array instead of old accuracyAssessment field
        if ('transcriptionOutput' in details && typeof details.transcriptionOutput === 'object' && details.transcriptionOutput && 'segments' in details.transcriptionOutput) {
          const segmentCount = Array.isArray((details.transcriptionOutput as any).segments) ? (details.transcriptionOutput as any).segments.length : 0;
          return `Transcribed. Segments: ${segmentCount}`;
        }
        if ('materialOutput' in details && typeof details.materialOutput === 'object' && details.materialOutput && 'deckTitle' in details.materialOutput) return `Material: ${(details.materialOutput as any).deckTitle?.substring(0,50) || 'N/A'}...`;
        if ('analysisOutput' in details && typeof details.analysisOutput === 'object' && details.analysisOutput && 'reportTitle' in details.analysisOutput) return `Analysis: ${(details.analysisOutput as any).reportTitle?.substring(0,50) || 'N/A'}...`;
        
        return JSON.stringify(details).substring(0,100) + (JSON.stringify(details).length > 100 ? '...' : '');
    }
    return 'N/A';
  };


  const handleExport = (format: 'csv' | 'pdf' | 'doc') => {
    if (filteredActivities.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no data to export.",
      });
      return;
    }
    try {
      const headers = ["Timestamp", "Module", "Product", "Agent Name", "Details Preview"];
      const dataForExport = filteredActivities.map(act => ({
        Timestamp: formatDate(parseISO(act.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        Module: act.module,
        Product: act.product || 'N/A',
        AgentName: act.agentName || 'N/A',
        DetailsPreview: getDetailsPreviewForExport(act.details),
      }));

      const dataRowsForPdfOrDoc = dataForExport.map(row => [
        row.Timestamp,
        row.Module,
        row.Product,
        row.AgentName,
        row.DetailsPreview,
      ]);
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `activity_log_${timestamp}`;

      if (format === 'csv') {
        exportToCsv(`${baseFilename}.csv`, dataForExport);
        toast({ title: "Export Successful", description: "Activity log exported as CSV (for Excel)." });
      } else if (format === 'pdf') {
        exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Activity log table exported as PDF." });
      } else if (format === 'doc') {
        exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Activity log table exported as Text for Word (.doc)." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export data to ${format.toUpperCase()}. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error(`Activity Log ${format.toUpperCase()} Export error:`, error);
    }
  };
  

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Activity Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:px-6 md:py-3 space-y-4">
        <div className="md:sticky md:top-16 md:z-20 md:bg-background md:pt-3 md:pb-2">
          {isClient ? <ActivityDashboardFilters onFilterChange={setFilters} availableModules={availableModules} availableProducts={availableProducts.map(p => p.name)}/> : <Skeleton className="h-32 w-full" />}
        </div>
        
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <List className="mr-2 h-4 w-4" /> Export Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV (for Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" /> Export Table as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('doc')}>
                <FileText className="mr-2 h-4 w-4" /> Export Table as Text for Word (.doc)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isClient ? (
          <ActivityTable activities={filteredActivities} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          Note: Activity details are textual summaries. Direct links to generated outputs are not available in this version. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}
