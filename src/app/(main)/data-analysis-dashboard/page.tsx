
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { DataAnalysisDashboardTable } from '@/components/features/data-analysis-dashboard/dashboard-table'; 
import type { HistoricalAnalysisReportItem } from '@/types'; // Updated import
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, List, FileSpreadsheet, Trash2 } from 'lucide-react';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useProductContext } from '@/hooks/useProductContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


export default function DataAnalysisDashboardPage() {
  const { activities, deleteActivities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { availableProducts } = useProductContext();
  const [productFilter, setProductFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const dataAnalysisHistory: HistoricalAnalysisReportItem[] = useMemo(() => {
    if (!isClient) return []; 
    return (activities || [])
      .filter(activity => 
        activity.module === "Data Analysis" && 
        activity.details && 
        typeof activity.details === 'object' &&
        'inputData' in activity.details &&
        typeof (activity.details as any).inputData === 'object' &&
        ('analysisOutput' in activity.details || 'error' in activity.details) 
      )
      .map(activity => activity as HistoricalAnalysisReportItem) 
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const filteredHistory = useMemo(() => {
    const productFiltered = productFilter === "All" ? dataAnalysisHistory : dataAnalysisHistory.filter(item => item.product === productFilter);
    return productFiltered;
  }, [dataAnalysisHistory, productFilter]);

  // When filter changes, clear selection
  useEffect(() => {
    setSelectedIds([]);
  }, [productFilter]);
  
  const handleDeleteSelected = () => {
    deleteActivities(selectedIds);
    toast({ title: "Reports Deleted", description: `${selectedIds.length} data analysis reports have been deleted.` });
    setSelectedIds([]);
  };

  const handleClearAllConfirm = () => {
    const idsToDelete = dataAnalysisHistory.map(item => item.id);
    deleteActivities(idsToDelete);
    toast({ title: "All Reports Deleted", description: "All data analysis reports have been cleared from the log." });
    setIsClearAlertOpen(false);
  };

  const handleExport = (formatType: 'csv' | 'pdf' | 'doc') => {
    if (filteredHistory.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: `There is no Data Analysis Report history for product '${productFilter}' to export.`,
      });
      return;
    }
    try {
      const headers = ["Timestamp", "Agent Name", "Report Title", "User Prompt Summary", "File Context Count", "File Context Names", "Error"];
      const dataForExportObjects = filteredHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        ReportTitle: item.details.analysisOutput?.reportTitle || (item.details.error ? 'Error in generation' : 'N/A'),
        UserPromptSummary: item.details.inputData.userAnalysisPrompt.substring(0,100) + (item.details.inputData.userAnalysisPrompt.length > 100 ? '...' : ''),
        FileContextCount: item.details.inputData.fileDetails.length,
        FileContextNames: item.details.inputData.fileDetails.map(f => f.fileName).join('; ').substring(0,100) + (item.details.inputData.fileDetails.map(f => f.fileName).join('; ').length > 100 ? '...' : ''),
        Error: item.details.error || '',
      }));
      
      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => [
        row.Timestamp,
        row.AgentName,
        row.ReportTitle,
        row.UserPromptSummary,
        String(row.FileContextCount),
        row.FileContextNames,
        row.Error,
      ]);

      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `data_analysis_report_history_${productFilter}_${timestamp}`;

      if (formatType === 'csv') {
        exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
        toast({ title: "Export Successful", description: "Data Analysis Report history exported as CSV (for Excel)." });
      } else if (formatType === 'pdf') {
        exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Data Analysis Report history table exported as PDF." });
      } else if (formatType === 'doc') {
        exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Data Analysis Report history table exported as Text for Word (.doc)." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export Data Analysis Report history to ${formatType.toUpperCase()}. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error(`Data Analysis Report History ${formatType.toUpperCase()} Export error:`, error);
    }
  };


  return (
    <>
      <div className="flex flex-col h-full">
        <PageHeader title="Data Analysis Report Dashboard" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
           <div className="flex justify-between items-center flex-wrap gap-2">
               <div className='flex items-center gap-2'>
                  <Label htmlFor="product-filter" className="text-sm">Product:</Label>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                      <SelectTrigger id="product-filter" className="w-[180px]">
                          <SelectValue placeholder="Filter by product" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Products</SelectItem>
                          {availableProducts.map(p => <SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button variant="destructive" onClick={handleDeleteSelected} disabled={selectedIds.length === 0}>
                   <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.length})
                </Button>
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <List className="mr-2 h-4 w-4" /> More Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('csv')}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Table as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('pdf')}>
                      <FileText className="mr-2 h-4 w-4" /> Export Table as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('doc')}>
                      <FileText className="mr-2 h-4 w-4" /> Export Table as Text
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsClearAlertOpen(true)} disabled={dataAnalysisHistory.length === 0} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Clear All Analysis History
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          </div>
          {isClient ? (
            <DataAnalysisDashboardTable history={filteredHistory} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
           <div className="text-xs text-muted-foreground p-4 border-t">
            This dashboard displays a history of generated Data Analysis Reports. Each entry provides an AI-generated report based on your detailed prompts and file context. 
            Original uploaded files (e.g., Excel, PDF) are not stored and cannot be re-downloaded from here. The AI analyzes based on descriptions and (for CSV/TXT) small samples.
            Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
          </div>
        </main>
      </div>
      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all ({dataAnalysisHistory.length}) data analysis reports from your activity log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, Clear All Reports
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
