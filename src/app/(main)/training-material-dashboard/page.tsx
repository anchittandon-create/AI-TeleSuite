
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TrainingMaterialDashboardTable } from '@/components/features/training-material-dashboard/dashboard-table';
import type { HistoricalMaterialItem, ActivityLogEntry } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, List, FileSpreadsheet } from 'lucide-react';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TrainingMaterialDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const trainingMaterialHistory: HistoricalMaterialItem[] = useMemo(() => {
    if (!isClient) return [];
    return (activities || [])
      .filter(activity =>
        activity.module === "Create Training Material" &&
        activity.details &&
        typeof activity.details === 'object' &&
        'inputData' in activity.details &&
        'materialOutput' in activity.details && 
        typeof (activity.details as any).inputData === 'object' &&
        typeof (activity.details as any).materialOutput === 'object'
      )
      .map(activity => activity as ActivityLogEntry as HistoricalMaterialItem) 
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleExport = (formatType: 'csv' | 'pdf' | 'doc') => {
    if (trainingMaterialHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no training material history to export.",
      });
      return;
    }
    try {
      const headers = ["Timestamp", "Agent Name", "Product", "Material Title", "Format", "Context Source", "Error"];
      const dataForExportObjects = trainingMaterialHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.details.inputData.product,
        MaterialTitle: item.details.materialOutput?.deckTitle || (item.details.error ? 'Error in generation' : 'N/A'),
        Format: item.details.inputData.deckFormatHint,
        ContextSource: (item.details.inputData.sourceDescriptionForAi || (item.details.inputData.generateFromAllKb ? 'Entire KB' : `${item.details.inputData.knowledgeBaseItems.length} KB items/uploads`)).substring(0,100) + "...",
        Error: item.details.error || '',
      }));
      
      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => [
        row.Timestamp,
        row.AgentName,
        row.Product,
        row.MaterialTitle,
        row.Format,
        row.ContextSource,
        row.Error,
      ]);

      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `training_material_history_${timestamp}`;

      if (formatType === 'csv') {
        exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
        toast({ title: "Export Successful", description: "Training material history exported as CSV (for Excel)." });
      } else if (formatType === 'pdf') {
        exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Training material history table exported as PDF." });
      } else if (formatType === 'doc') {
        exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Training material history table exported as Text for Word (.doc)." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export training material history to ${formatType.toUpperCase()}. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error(`Training Material History ${formatType.toUpperCase()} Export error:`, error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Training Material Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
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
          <TrainingMaterialDashboardTable key={`material-dashboard-table-${(trainingMaterialHistory || []).length}`} history={trainingMaterialHistory} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          This dashboard displays a history of generated Training Materials (Decks/Brochures). Each entry's content outline can be viewed and downloaded.
          Original uploaded files used as context are not stored and cannot be re-downloaded from here. The AI generates content based on file names/types and (for text-based files/prompts) their content.
          Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}

