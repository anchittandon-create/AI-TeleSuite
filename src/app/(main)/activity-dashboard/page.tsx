
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger } from '@/hooks/use-activity-logger';
import { ActivityTable } from '@/components/features/activity-dashboard/activity-table';
import { ActivityDashboardFilters, ActivityFilters } from '@/components/features/activity-dashboard/filters';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Sheet } from 'lucide-react'; // Sheet icon for export
import { exportToCsv } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { ActivityLogEntry, Product } from '@/types'; 
import { parseISO, startOfDay, endOfDay, format as formatDate } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';


export default function ActivityDashboardPage() {
  const { activities } = useActivityLogger();
  const [filters, setFilters] = useState<ActivityFilters>({ product: "All" });
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const availableModules = useMemo(() => {
    if (!isClient) return [];
    const modules = new Set(activities.map(a => a.module));
    return Array.from(modules);
  }, [activities, isClient]);

  const filteredActivities = useMemo(() => {
    if (!isClient) return [];
    return activities.filter(activity => {
      if (filters.dateFrom && parseISO(activity.timestamp) < startOfDay(filters.dateFrom)) return false;
      if (filters.dateTo && parseISO(activity.timestamp) > endOfDay(filters.dateTo)) return false;
      if (filters.agentName && !activity.agentName?.toLowerCase().includes(filters.agentName.toLowerCase())) return false;
      if (filters.module && activity.module !== filters.module) return false;
      if (filters.product && filters.product !== "All" && activity.product !== filters.product) return false;
      return true;
    });
  }, [activities, filters, isClient]);

  const handleExportCsv = () => {
    if (filteredActivities.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no data to export.",
      });
      return;
    }
    try {
      const activitiesForExport = filteredActivities.map(act => ({
        ...act,
        details: typeof act.details === 'string' ? act.details : JSON.stringify(act.details),
        timestamp: formatDate(parseISO(act.timestamp), 'yyyy-MM-dd HH:mm:ss')
      }));
      exportToCsv('activity_log.csv', activitiesForExport);
      toast({
        title: "Export Successful",
        description: "Activity log exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export data to CSV.",
      });
      console.error("CSV Export error:", error);
    }
  };
  

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Activity Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {isClient ? <ActivityDashboardFilters onFilterChange={setFilters} availableModules={availableModules} /> : <Skeleton className="h-32 w-full" />}
        
        <div className="flex justify-end">
          <Button onClick={handleExportCsv} variant="outline">
            <Sheet className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {isClient ? (
          <ActivityTable key={filteredActivities.length} activities={filteredActivities} />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          Note: Activity details are textual summaries. Direct links to generated outputs are not available in this version. Activity log is limited to the most recent entries.
        </div>
      </main>
    </div>
  );
}
