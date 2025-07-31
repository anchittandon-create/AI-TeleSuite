
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useActivityLogger, MAX_ACTIVITIES_TO_STORE } from '@/hooks/use-activity-logger';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { CallScoringResultsCard } from '@/components/features/call-scoring/call-scoring-results-card';
import { exportToCsv, exportTableDataToPdf, exportTableDataForDoc, exportPlainTextFile } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Eye, List, FileSpreadsheet, FileText, BarChartHorizontalIcon, AlertCircleIcon, Info, Copy, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActivityLogEntry, VoiceSalesAgentActivityDetails, ScoreCallOutput, Product } from '@/types';
import { useProductContext } from '@/hooks/useProductContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface HistoricalSalesCallItem extends Omit<ActivityLogEntry, 'details'> {
  details: VoiceSalesAgentActivityDetails;
}

export default function VoiceSalesDashboardPage() {
  const { activities } = useActivityLogger();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [selectedCall, setSelectedCall] = useState<HistoricalSalesCallItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { availableProducts } = useProductContext();
  const [productFilter, setProductFilter] = useState<string>("All");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const salesCallHistory: HistoricalSalesCallItem[] = useMemo(() => {
    if (!isClient) return [];
    return (activities || [])
      .filter(activity =>
        activity.module === "Voice Sales Agent" &&
        activity.details &&
        typeof activity.details === 'object' &&
        'input' in activity.details &&
        ('finalScore' in activity.details || 'error' in activity.details)
      )
      .map(activity => activity as HistoricalSalesCallItem)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, isClient]);

  const filteredHistory = useMemo(() => {
    if (productFilter === 'All') {
      return salesCallHistory;
    }
    return salesCallHistory.filter(item => item.product === productFilter);
  }, [salesCallHistory, productFilter]);
  
  const handleViewDetails = (item: HistoricalSalesCallItem) => {
    setSelectedCall(item);
    setIsDialogOpen(true);
  };

  const handleCopyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Success", description: `${type} copied to clipboard!` }))
      .catch(() => toast({ variant: "destructive", title: "Error", description: `Failed to copy ${type.toLowerCase()}.` }));
  };

  const handleDownloadFile = (content: string, fileNameBase: string, type: "transcript" | "summary") => {
    if (!content) return;
    try {
      const fileExtension = type === "transcript" ? "_transcript.txt" : "_summary.txt";
      const fullFileName = `${fileNameBase.replace(/[^a-zA-Z0-9]/g, '_')}${fileExtension}`;
      exportPlainTextFile(fullFileName, content);
      toast({ title: "Download Successful", description: `${type} file '${fullFileName}' downloaded.` });
    } catch (error) {
       toast({ variant: "destructive", title: "Download Error", description: `Failed to download ${type} file.` });
    }
  };


  const handleExportTable = (formatType: 'csv' | 'pdf' | 'doc') => {
    if (filteredHistory.length === 0) {
      toast({ title: "No Data", description: `No sales call history for '${productFilter}' to export.` });
      return;
    }
    try {
      const headers = ["Timestamp", "App Agent", "AI Agent Name", "Customer Name", "Product", "Cohort", "Overall Score", "Call Category", "Error"];
      const dataForExportObjects = filteredHistory.map(item => {
        const scoreOutput = item.details.finalScore;
        return {
          Timestamp: format(parseISO(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
          AppAgent: item.agentName || 'N/A',
          AIAgentName: item.details.input.agentName || 'N/A',
          CustomerName: item.details.input.userName || 'N/A',
          Product: item.details.input.product,
          Cohort: item.details.input.customerCohort,
          OverallScore: scoreOutput ? scoreOutput.overallScore.toFixed(1) : 'N/A',
          CallCategory: scoreOutput ? scoreOutput.callCategorisation : 'N/A',
          Error: item.details.error || '',
        };
      });

      const dataRowsForPdfOrDoc = dataForExportObjects.map(row => Object.values(row));
      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const baseFilename = `voice_sales_call_history_${productFilter}_${timestamp}`;

      if (formatType === 'csv') exportToCsv(`${baseFilename}.csv`, dataForExportObjects);
      else if (formatType === 'pdf') exportTableDataToPdf(`${baseFilename}.pdf`, headers, dataRowsForPdfOrDoc);
      else if (formatType === 'doc') exportTableDataForDoc(`${baseFilename}.doc`, headers, dataRowsForPdfOrDoc);
      
      toast({ title: "Export Successful", description: `Sales call history exported as ${formatType.toUpperCase()}.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Export Failed", description: `Could not export history. Error: ${error instanceof Error ? error.message : String(error)}`});
    }
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Voice Sales Agent - Call Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-blue-800">Dashboard Overview</AlertTitle>
            <AlertDescription className="text-xs">
              This dashboard displays logs of simulated sales calls initiated via the "AI Voice Sales Agent" module. 
              Each entry includes the conversation transcript (text-based simulation), call score, and input parameters.
              Actual audio recordings are not stored in this prototype.
            </AlertDescription>
        </Alert>

        <div className="flex justify-between items-center">
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
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><List className="mr-2 h-4 w-4" /> Export Options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportTable('csv')}><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Table as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportTable('pdf')}><FileText className="mr-2 h-4 w-4" /> Export Table as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportTable('doc')}><FileText className="mr-2 h-4 w-4" /> Export Table as Text for Word</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isClient ? (
          <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center"><BarChartHorizontalIcon className="mr-2 h-5 w-5 text-primary"/>Simulated Sales Call Logs</CardTitle>
                <CardDescription>History of AI-driven sales call simulations. Click "View" for details.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-460px)] md:h-[calc(100vh-400px)]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/50">
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredHistory.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No sales call simulations logged for '{productFilter}' yet.</TableCell></TableRow>
                        ) : (
                            filteredHistory.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-xs">{format(parseISO(item.timestamp), 'PP p')}</TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" title={item.details.input.userName || "Unknown User"}>
                                  {item.details.input.userName || "Unknown User"}
                                </TableCell>
                                <TableCell className="text-xs">{item.details.input.product}</TableCell>
                                <TableCell className="text-center text-xs">{item.details.finalScore ? `${item.details.finalScore.overallScore.toFixed(1)}/5` : 'N/A'}</TableCell>
                                <TableCell className="text-center">
                                {item.details.error ? <Badge variant="destructive" className="text-xs">Error</Badge> : <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Completed</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                <Button variant="outline" size="xs" onClick={() => handleViewDetails(item)}><Eye className="mr-1.5 h-3.5 w-3.5" /> View</Button>
                                </TableCell>
                            </TableRow>
                            ))
                        )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" /> <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" />
          </div>
        )}
         <div className="text-xs text-muted-foreground p-4 border-t">
          Activity log is limited to the most recent {MAX_ACTIVITIES_TO_STORE} entries. Detailed scoring and transcripts are available in the "View" dialog.
        </div>

        {selectedCall && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-4 pb-3 border-b sticky top-0 bg-background z-10">
                <DialogTitle className="text-lg text-primary">Sales Call Simulation Details</DialogTitle>
                <DialogDesc className="text-xs">
                    Customer: {selectedCall.details.input.userName || "N/A"} | Product: {selectedCall.details.input.product} | Date: {format(parseISO(selectedCall.timestamp), 'PPPP pppp')}
                </DialogDesc>
                </DialogHeader>
                <ScrollArea className="flex-grow p-4 overflow-y-auto">
                    {selectedCall.details.error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircleIcon className="h-4 w-4" />
                            <AlertTitle>Error during call simulation</AlertTitle>
                            <AlertDescription>{selectedCall.details.error}</AlertDescription>
                        </Alert>
                    )}
                    {selectedCall.details.input && (
                        <Card className="mb-4 bg-muted/30">
                            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Call Setup Parameters</CardTitle></CardHeader>
                            <CardContent className="text-xs px-4 pb-3 space-y-1">
                                <p><strong>AI Agent:</strong> {selectedCall.details.input.agentName || "Default AI"}</p>
                                <p><strong>Customer:</strong> {selectedCall.details.input.userName || "N/A"}</p>
                                <p><strong>Product:</strong> {selectedCall.details.input.product} | <strong>Cohort:</strong> {selectedCall.details.input.customerCohort}</p>
                            </CardContent>
                        </Card>
                    )}
                    {selectedCall.details.fullTranscriptText && (
                        <Card className="mb-4">
                            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Conversation Transcript (Simulated)</CardTitle></CardHeader>
                            <CardContent className="px-4 pb-3">
                                <Textarea value={selectedCall.details.fullTranscriptText} readOnly className="h-48 text-xs bg-background/50 whitespace-pre-wrap" />
                                <div className="mt-2 flex gap-2">
                                     <Button variant="outline" size="xs" onClick={() => handleCopyToClipboard(selectedCall.details.fullTranscriptText!, 'Transcript')}><Copy className="mr-1 h-3"/>Copy</Button>
                                     <Button variant="outline" size="xs" onClick={() => handleDownloadFile(selectedCall.details.fullTranscriptText!, `SalesCall_${selectedCall.details.input.userName || 'User'}`, "transcript")}><Download className="mr-1 h-3"/>Download .txt</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                     {selectedCall.details.finalScore && (
                        <CallScoringResultsCard results={selectedCall.details.finalScore as ScoreCallOutput} fileName={selectedCall.details.finalScore.fileName || "Simulated Interaction"} isHistoricalView={true} />
                     )}
                </ScrollArea>
                <DialogFooter className="p-3 border-t bg-muted/50 sticky bottom-0">
                    <Button onClick={() => setIsDialogOpen(false)} size="sm">Close</Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        )}
      </main>
    </div>
  );
}
