
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { CallScoringDashboardTable } from '@/components/features/call-scoring-dashboard/dashboard-table';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, List, FileSpreadsheet, Download, FileArchive } from 'lucide-react';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc } from '@/lib/export';
import { generateCallScoreReportPdfBlob } from '@/lib/pdf-utils';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useProductContext } from '@/hooks/useProductContext';

export interface HistoricalScoreItem {
  id: string;
  timestamp: string;
  agentName?: string;
  product?: string;
  fileName: string;
  scoreOutput: ScoreCallOutput;
}

export default function CallScoringDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { availableProducts } = useProductContext();
  const [productFilter, setProductFilter] = useState<string>("All");


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
        'scoreOutput' in activity.details &&
        'fileName' in activity.details &&
        typeof (activity.details as any).fileName === 'string' &&
        typeof (activity.details as any).scoreOutput === 'object' &&
        !('error' in activity.details && !(activity.details as any).scoreOutput)
      )
      .map(activity => {
        const details = activity.details as { fileName: string, scoreOutput: ScoreCallOutput, agentNameFromForm?: string };
        const effectiveAgentName = (details.agentNameFromForm && details.agentNameFromForm.trim() !== "") ? details.agentNameFromForm : activity.agentName;

        return {
          id: activity.id,
          timestamp: activity.timestamp,
          agentName: effectiveAgentName,
          product: activity.product,
          fileName: details.fileName,
          scoreOutput: details.scoreOutput,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const filteredHistory = useMemo(() => {
    if (productFilter === "All") {
      return scoredCallsHistory;
    }
    return scoredCallsHistory.filter(item => item.product === productFilter);
  }, [scoredCallsHistory, productFilter]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const handleExportZip = useCallback(async (idsToExport: string[], all: boolean) => {
    const itemsToExport = all ? filteredHistory : filteredHistory.filter(item => idsToExport.includes(item.id));
    
    if (itemsToExport.length === 0) {
      toast({ variant: "default", title: "No Reports Selected", description: "Please select one or more reports to export from the currently filtered view." });
      return;
    }
    
    toast({ title: "Preparing ZIP...", description: `Bundling ${itemsToExport.length} report(s). This may take a moment.` });

    try {
      const zip = new JSZip();
      for (const item of itemsToExport) {
        if (item.scoreOutput && item.scoreOutput.callCategorisation !== "Error") {
          const pdfBlob = generateCallScoreReportPdfBlob(item);
          const baseName = item.fileName.includes('.') ? item.fileName.substring(0, item.fileName.lastIndexOf('.')) : item.fileName;
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

      toast({ title: "Export Successful", description: `${itemsToExport.length} PDF report(s) have been downloaded as a ZIP file.` });

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
      const headers = ["Timestamp", "Agent Name", "Product", "File Name", "Overall Score", "Categorization", "Summary Preview", "Transcript Accuracy"];
      const dataForExportObjects = filteredHistory.map(item => ({
        Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        AgentName: item.agentName || 'N/A',
        Product: item.product || 'N/A',
        FileName: item.fileName,
        OverallScore: item.scoreOutput.overallScore,
        CallCategorisation: item.scoreOutput.callCategorisation,
        SummaryPreview: item.scoreOutput.summary.substring(0,100) + (item.scoreOutput.summary.length > 100 ? '...' : ''),
        TranscriptAccuracy: item.scoreOutput.transcriptAccuracy,
      }));

      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => [
        row.Timestamp,
        row.AgentName,
        row.Product,
        row.FileName,
        String(row.OverallScore),
        String(row.CallCategorisation),
        row.SummaryPreview,
        row.TranscriptAccuracy,
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
    <div className="flex flex-col h-full">
      <PageHeader title="Call Scoring Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center gap-2">
            <div className='flex items-center gap-2'>
                <Label htmlFor="product-filter" className="text-sm">Product:</Label>
                <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger id="product-filter" className="w-[180px]">
                        <SelectValue placeholder="Filter by product" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Products</SelectItem>
                        {availableProducts.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className='flex gap-2'>
                <Button
                    onClick={() => handleExportZip(selectedIds, false)}
                    disabled={selectedIds.length === 0}
                >
                    <Download className="mr-2 h-4 w-4" /> Export Selected as ZIP ({selectedIds.length})
                </Button>
               <Button
                    onClick={() => handleExportZip([], true)}
                    variant="outline"
                    disabled={filteredHistory.length === 0}
                >
                    <FileArchive className="mr-2 h-4 w-4" /> Export All as ZIP ({filteredHistory.length})
                </Button>
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <List className="mr-2 h-4 w-4" /> Export Table View...
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportTable('csv')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Table as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportTable('pdf')}>
                    <FileText className="mr-2 h-4 w-4" /> Export Table as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportTable('doc')}>
                    <FileText className="mr-2 h-4 w-4" /> Export Table as Text for Word
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
          This dashboard displays a history of scored calls. Original audio playback/download is not available for historical entries to conserve browser storage space. Full scoring reports can be viewed and exported. Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries.
        </div>
      </main>
    </div>
  );
}
