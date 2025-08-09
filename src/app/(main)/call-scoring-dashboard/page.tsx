
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { CallScoringDashboardTable } from '@/components/features/call-scoring-dashboard/dashboard-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, List, FileSpreadsheet, Download, FileArchive, Trash2 } from 'lucide-react';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc } from '@/lib/export';
import { generateCallScoreReportPdfBlob } from '@/lib/pdf-utils';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useProductContext } from '@/hooks/useProductContext';
import type { HistoricalScoreItem } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


export default function CallScoringDashboardPage() {
  const { activities, deleteActivities, clearAllActivities } from useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { availableProducts } = useProductContext();
  const [productFilter, setProductFilter] = useState<string>("All");
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const scoredCallsHistory: HistoricalScoreItem[] = useMemo(() => {
    if (!isClient) return [];
    return (activities || [])
      .filter(activity =>
        activity.module === "Call Scoring" &&
        activity.details &&
        typeof activity.details === 'object' &&
        'fileName' in activity.details
      )
      .map(activity => activity as HistoricalScoreItem)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const filteredHistory = useMemo(() => {
    if (productFilter === "All") {
      return scoredCallsHistory;
    }
    return scoredCallsHistory.filter(item => item.product === productFilter);
  }, [scoredCallsHistory, productFilter]);
  
  // When filter changes, clear selection
  useEffect(() => {
    setSelectedIds([]);
  }, [productFilter]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);
  
  const handleDeleteSelected = () => {
    deleteActivities(selectedIds);
    toast({ title: "Reports Deleted", description: `${selectedIds.length} scoring reports have been deleted.` });
    setSelectedIds([]);
  };
  
  const handleClearAllConfirm = () => {
    const idsToDelete = scoredCallsHistory.map(item => item.id);
    deleteActivities(idsToDelete);
    toast({ title: "All Reports Deleted", description: "All call scoring reports have been cleared from the log." });
    setIsClearAlertOpen(false);
  };


  const handleExportZip = useCallback(async (idsToExport: string[], all: boolean) => {
    const itemsToExport = all ? filteredHistory : filteredHistory.filter(item => idsToExport.includes(item.id));
    
    if (itemsToExport.length === 0) {
      toast({ variant: "default", title: "No Reports Selected", description: "Please select one or more reports to export from the currently filtered view." });
      return;
    }
    
    const validItemsToExport = itemsToExport.filter(item => item.details.scoreOutput && item.details.status === 'Complete');
    if (validItemsToExport.length === 0) {
        toast({ variant: "default", title: "No Completed Reports", description: "Only successfully completed scoring reports can be exported as PDFs." });
        return;
    }
    
    toast({ title: "Preparing ZIP...", description: `Bundling ${validItemsToExport.length} report(s). This may take a moment.` });

    try {
      const zip = new JSZip();
      for (const item of validItemsToExport) {
        if (item.details.scoreOutput && item.details.status === 'Complete') {
          const pdfBlob = await generateCallScoreReportPdfBlob(item);
          const baseName = item.details.fileName.includes('.') ? item.details.fileName.substring(0, item.details.fileName.lastIndexOf('.')) : item.details.fileName;
          zip.file(`${baseName}_Report.pdf`, pdfBlob);
        }
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      link.download = `Call_Reports_Export_${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: "Export Successful", description: `${validItemsToExport.length} PDF report(s) have been downloaded as a ZIP file.` });

    } catch (error) {
      console.error("ZIP Export error:", error);
      toast({ variant: "destructive", title: "Export Failed", description: `Could not export reports. Error: ${error instanceof Error ? error.message : String(error)}` });
    }
  }, [filteredHistory, toast]);


  const handleExportTable = (formatType: 'csv' | 'pdf' | 'doc') => {
    if (filteredHistory.length === 0) {
      toast({ variant: "default", title: "No Data", description: `There is no call scoring history for the selected product filter to export.` });
      return;
    }
    try {
      const headers = ["Timestamp", "Agent Name", "Product", "File Name", "Overall Score", "Categorization", "Status", "Error"];
      const dataForExportObjects = filteredHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.product || 'N/A',
        FileName: item.details.fileName,
        OverallScore: item.details.scoreOutput?.overallScore ?? 'N/A',
        CallCategorisation: item.details.scoreOutput?.callCategorisation ?? 'N/A',
        Status: item.details.status,
        Error: item.details.error || 'N/A',
      }));

      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => [
        row.Timestamp,
        row.AgentName,
        row.Product,
        row.FileName,
        String(row.OverallScore),
        String(row.CallCategorisation),
        row.Status,
        row.Error,
      ]);

      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `call_scoring_history_${productFilter}_${timestamp}`;

      if (formatType === 'csv') {
        exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
        toast({ title: "Export Successful", description: "Call scoring history exported as CSV (for Excel)." });
      } else if (formatType === 'pdf') {
        exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Call scoring history table exported as PDF." });
      } else if (formatType === 'doc') {
        exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
        toast({ title: "Export Successful", description: "Call scoring history table exported as Text for Word (.doc)." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: `Could not export call scoring history to ${formatType.toUpperCase()}. Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error(`Call Scoring History ${formatType.toUpperCase()} Export error:`, error);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <PageHeader title="Call Scoring Dashboard" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex justify-between items-center gap-2 flex-wrap">
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
              <div className='flex gap-2 flex-wrap justify-end'>
                  <Button
                      onClick={handleDeleteSelected}
                      disabled={selectedIds.length === 0}
                      variant="destructive"
                  >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.length})
                  </Button>
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <List className="mr-2 h-4 w-4" /> More Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExportZip(selectedIds, false)} disabled={selectedIds.length === 0}>
                      <Download className="mr-2 h-4 w-4" /> Export Selected as ZIP ({selectedIds.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportZip([], true)} disabled={filteredHistory.length === 0}>
                      <FileArchive className="mr-2 h-4 w-4" /> Export All as ZIP ({filteredHistory.length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExportTable('csv')}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Table as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportTable('pdf')}>
                      <FileText className="mr-2 h-4 w-4" /> Export Table as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportTable('doc')}>
                      <FileText className="mr-2 h-4 w-4" /> Export Table as Text
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsClearAlertOpen(true)} disabled={scoredCallsHistory.length === 0} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Clear All Scoring History
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          </div>
          {isClient ? (
            <CallScoringDashboardTable
              history={filteredHistory}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
           <div className="text-xs text-muted-foreground p-4 border-t">
            This dashboard displays a history of scored calls. Original audio playback/download is not available for historical entries to conserve browser storage. Full scoring reports can be viewed and exported. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
          </div>
        </main>
      </div>

       <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all ({scoredCallsHistory.length}) call scoring reports from your activity log. This action cannot be undone.
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
