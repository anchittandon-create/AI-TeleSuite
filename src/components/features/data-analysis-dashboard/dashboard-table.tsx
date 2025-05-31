
"use client";

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowUpDown, FileText, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ActivityLogEntry } from '@/types';
import type { DataAnalysisOutput } from '@/ai/flows/data-analyzer';
import { DataAnalysisResultsCard } from '@/components/features/data-analysis/data-analysis-results-card';

interface DataAnalysisActivityDetails {
  inputData: {
    fileName: string;
    fileType: string;
    userDescription?: string;
  };
  analysisOutput?: DataAnalysisOutput; // Optional if there was an error
  error?: string;
}

export interface HistoricalAnalysisItem extends ActivityLogEntry {
  details: DataAnalysisActivityDetails;
}

interface DataAnalysisDashboardTableProps {
  history: HistoricalAnalysisItem[];
}

type SortKey = keyof HistoricalAnalysisItem['details']['inputData'] | 'timestamp' | 'module' | 'analysisTitle' | null;
type SortDirection = 'asc' | 'desc';


export function DataAnalysisDashboardTable({ history }: DataAnalysisDashboardTableProps) {
  const [selectedItem, setSelectedItem] = useState<HistoricalAnalysisItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleViewDetails = (item: HistoricalAnalysisItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };
  
  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-1 h-3 w-3 inline transform rotate-180" /> : <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      let valA: any, valB: any;

      switch (sortKey) {
        case 'fileName':
          valA = a.details.inputData.fileName;
          valB = b.details.inputData.fileName;
          break;
        case 'fileType':
          valA = a.details.inputData.fileType;
          valB = b.details.inputData.fileType;
          break;
        case 'userDescription':
          valA = a.details.inputData.userDescription || '';
          valB = b.details.inputData.userDescription || '';
          break;
        case 'analysisTitle':
          valA = a.details.analysisOutput?.analysisTitle || (a.details.error ? 'Error' : '');
          valB = b.details.analysisOutput?.analysisTitle || (b.details.error ? 'Error' : '');
          break;
        case 'timestamp':
          valA = new Date(a.timestamp).getTime();
          valB = new Date(b.timestamp).getTime();
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else {
        if (valA === undefined || valA === null) comparison = -1;
        else if (valB === undefined || valB === null) comparison = 1;
      }
      return sortDirection === 'desc' ? comparison * -1 : comparison;
    });
  }, [history, sortKey, sortDirection]);


  return (
    <>
      <div className="w-full mt-2 shadow-lg rounded-lg border bg-card">
        <ScrollArea className="h-[calc(100vh-280px)] md:h-[calc(100vh-250px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead onClick={() => requestSort('fileName')} className="cursor-pointer">File Name {getSortIndicator('fileName')}</TableHead>
                <TableHead onClick={() => requestSort('userDescription')} className="cursor-pointer">User Goal {getSortIndicator('userDescription')}</TableHead>
                <TableHead onClick={() => requestSort('analysisTitle')} className="cursor-pointer">Analysis Title {getSortIndicator('analysisTitle')}</TableHead>
                <TableHead onClick={() => requestSort('timestamp')} className="cursor-pointer">Date Analyzed {getSortIndicator('timestamp')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No data analyses logged yet. Analyze some files to see them here.
                  </TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={item.details.inputData.fileName}>
                      <FileText className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                      {item.details.inputData.fileName}
                       <Badge variant="outline" className="ml-2 text-xs">{item.details.inputData.fileType}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate" title={item.details.inputData.userDescription}>
                        {item.details.inputData.userDescription || <span className="text-xs text-muted-foreground italic">Not provided</span>}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate" title={item.details.analysisOutput?.analysisTitle}>
                      {item.details.error ? <Badge variant="destructive">Error</Badge> : item.details.analysisOutput?.analysisTitle || <span className="text-xs text-muted-foreground italic">N/A</span>}
                    </TableCell>
                    <TableCell>{format(parseISO(item.timestamp), 'PP p')}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item)}
                          title={"View Full Analysis Report"}
                      >
                        <Eye className="mr-1.5 h-4 w-4" /> Report
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {selectedItem && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl min-h-[70vh] max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="text-xl text-primary">Detailed Analysis Report</DialogTitle>
                <DialogDescription>
                    File: {selectedItem.details.inputData.fileName} (Analyzed on: {format(parseISO(selectedItem.timestamp), 'PP p')})
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto">
              <div className="p-6">
                {selectedItem.details.error ? (
                     <div className="space-y-2 text-sm text-destructive bg-destructive/10 p-4 rounded-md">
                        <p className="font-semibold text-lg">Error During Analysis:</p>
                        <p><strong>File:</strong> {selectedItem.details.inputData.fileName}</p>
                        <p><strong>User Goal:</strong> {selectedItem.details.inputData.userDescription || "Not provided"}</p>
                        <p><strong>Error Message:</strong> {selectedItem.details.error}</p>
                    </div>
                ) : selectedItem.details.analysisOutput ? (
                    <DataAnalysisResultsCard 
                        results={selectedItem.details.analysisOutput} 
                        fileName={selectedItem.details.inputData.fileName} 
                        userDescription={selectedItem.details.inputData.userDescription}
                    />
                ) : (
                    <p className="text-muted-foreground">No analysis output available for this entry.</p>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-muted/50">
              <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

    