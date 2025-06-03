
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { TrainingMaterialDashboardTable } from '@/components/features/training-material-dashboard/dashboard-table';
import type { HistoricalMaterialItem, ActivityLogEntry } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet as SheetIcon } from 'lucide-react';
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

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
        'materialOutput' in activity.details && // Check for output, ignore if only error
        typeof (activity.details as any).inputData === 'object' &&
        typeof (activity.details as any).materialOutput === 'object'
      )
      .map(activity => activity as ActivityLogEntry as HistoricalMaterialItem) // Type assertion
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const handleExportCsv = () => {
    if (trainingMaterialHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no training material history to export.",
      });
      return;
    }
    try {
      const dataForExport = trainingMaterialHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.details.inputData.product,
        MaterialTitle: item.details.materialOutput?.deckTitle || (item.details.error ? 'Error in generation' : 'N/A'),
        Format: item.details.inputData.deckFormatHint,
        ContextSource: item.details.inputData.sourceDescriptionForAi || (item.details.inputData.generateFromAllKb ? 'Entire KB' : `${item.details.inputData.knowledgeBaseItems.length} KB items/uploads`),
        Error: item.details.error || '',
      }));
      exportToCsv('training_material_history.csv', dataForExport);
      toast({
        title: "Export Successful",
        description: "Training material history exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export training material history to CSV.",
      });
      console.error("Training Material History CSV Export error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Training Material Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end">
           <Button onClick={handleExportCsv} variant="outline">
            <SheetIcon className="mr-2 h-4 w-4" /> Export All as CSV
          </Button>
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
          Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}
